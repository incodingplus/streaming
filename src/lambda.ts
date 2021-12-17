import type { EncodeVideoArgs, SplitJobArgs } from './types'
import { S3, Lambda } from 'aws-sdk'
import { spawn, execSync } from 'child_process'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import { Readable } from 'stream'

const s3 = new S3({
    region: 'ap-northeast-2',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_KEY
    }
})
const uploadS3 = new S3({
    region: 'ap-northeast-2',
    credentials: {
        accessKeyId: process.env.UPLOAD_S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.UPLOAD_S3_SECRET_KEY
    }
})

const lambda = new Lambda({
    region: 'ap-northeast-2',
    // credentials: {
    //     accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    //     secretAccessKey: process.env.AWS_SECRET
    // },
    httpOptions: {
        timeout: 1000 * 60 * 15,
    }
})

const ffmpegPath = '/opt/bin/ffmpeg'

export const encodeVideo = async ({ bucket, videoKey, startTime, duration, tsSubSuffix }: EncodeVideoArgs) => {
    
    const _s3 = bucket === 'bucket-wxsyy6' ? s3 : uploadS3

    console.log({ bucket, videoKey, startTime, duration, tsSubSuffix })

    const stream = _s3.getObject({
        Bucket: bucket,
        Key: videoKey
    }).createReadStream();
    
    await new Promise((resolve, reject) => {
        console.time('ENCODING')

        execSync('rm -rf /tmp/videos && mkdir /tmp/videos')

        const mpeg_process = spawn(ffmpegPath, [
            ...(startTime == '00:00:00' ? [] : ['-ss', startTime]),
            '-i', '-',
            '-t', duration,
            '-profile:v', 'baseline',
            '-level', '3.0',
            '-hls_time', '10',
            '-hls_list_size', '0',
            '-hls_segment_filename', `/tmp/videos/index-${tsSubSuffix}-%d.ts`,
            '-f', 'hls',
            `/tmp/videos/index-${tsSubSuffix}.m3u8`
        ])
    
        mpeg_process.on('close', () => {
            console.log('인코딩 완료')
            resolve(null)
        })

        mpeg_process.stdin.on('error', () => {
            console.warn('mpeg process stdin 입력 중간에 끊김')
        })

        mpeg_process.stderr.pipe(process.stdout)

        stream.pipe(mpeg_process.stdin)
    })

    const filenames = fs.readdirSync('/tmp/videos')
    const files: { buf: Buffer, filename: string }[] = []
    await Promise.all(filenames.map(async (filename, idx) => {
        const buf = await fs.promises.readFile(`/tmp/videos/${filename}`)
        files[idx] = { buf, filename }
    }))

    console.info(`ts, m3u8 파일 ${files.length} 개 업로드 시작`)
    for(const { filename, buf } of files){
        const md5 = crypto.createHash('md5').update(buf).digest('base64')

        await _s3.putObject({
            Bucket: bucket,
            Key: path.join(videoKey.split('/').slice(0, -1).join('/'), filename),
            Body: buf,
            ContentType: filename.endsWith('.m3u8') ? 'application/x-mpegURL' : 'application/octet-stream',
            ContentMD5: md5
        }).promise()
        
        console.info(`ts 파일 ${filename} 업로드 완료`)
    }
    console.info(`ts, m3u8 파일 ${files.length} 개 업로드 완료`)

    return {
        m3u8: files.find(el => el.filename.endsWith('.m3u8')).buf.toString('hex')
    }
}

const convertSecondsTohhmmss = (seconds: number) => {
    const hh = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const mm = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
    const ss = Math.floor(seconds % 60).toString().padStart(2, '0')
    return `${hh}:${mm}:${ss}`
}

const invokeEncodeLambdaFunction = async (bucket: string, key: string, startTime: string, duration: string, tsSubSuffix: string) => {

    console.info(`인코딩 함수 호출 시작 ${key} ${startTime} - ${duration}`)
    const res = await lambda.invoke({
        FunctionName: 'split_video_into_ts',
        Payload: JSON.stringify({
            bucket,
            videoKey: key,
            startTime,
            duration,
            tsSubSuffix
        }),
    }).promise()

    // const state = workingState.get(key)
    // state.finished_count += 1
    console.info(`인코딩 함수 호출 완료 ${key} ${startTime} - ${duration}`)

    if(!(200 <= res.StatusCode && res.StatusCode < 300)) {
        console.error('encode lambda function 호출 중 에러')
        console.error(res.$response.error)
        throw res.$response.error
    }

    const { m3u8 } = JSON.parse(res.Payload.toString()) as { m3u8: string }
    return Buffer.from(m3u8, 'hex').toString()
}

const parseM3U8 = (m3u8: string) => {
    const lines = m3u8.split('\n').filter(el => el.trim() !== '')
    
    const targetDuration = Number(lines.find(el => /#EXT-X-TARGETDURATION/.test(el)).match(/^#EXT-X-TARGETDURATION:(\d+)$/)[1])
    
    return {
        lines: lines.slice(4, -1),
        targetDuration
    }
}

export const splitJob = async ({ bucket, videoKey }: SplitJobArgs) => {
    const _s3 = bucket === 'bucket-wxsyy6' ? s3 : uploadS3

    const stream = _s3.getObject({
        Bucket: bucket,
        Key: videoKey
    }).createReadStream();
    console.info(`영상 ${videoKey} 영상 길이 체크 시작`)

    let duration = await getVideoLength(stream);

    console.info(`영상 ${videoKey} 인코딩 시작 (duration: ${duration})`)

    const durations = []
    while(duration > 0) {
        // 6분씩 추가
        durations.push(Math.min(duration, 60 * 6))
        duration -= Math.min(duration, 60 * 6)
    }

    // workingState.set(key, {
    //     key, finished_count: 0, total_count: durations.length, durations
    // })

    if(durations.length == 0) {
        console.error(`영상 ${videoKey} durations 개수가 0 이라 인코딩 중지`)
        return
    }

    console.info(`영상 ${videoKey} durations: ${durations}`)

    // 마지막 시간이 3분 미만이면 앞 시간에 추가
    if(durations.length > 1 && durations[durations.length - 1] < 60 * 3) {
        durations[durations.length - 2] += durations[durations.length - 1]
        durations.pop()
    }

    const p = durations.map((d, idx) => {
        const startTime = convertSecondsTohhmmss(durations.slice(0, idx).reduce((sum, el) => el + sum, 0))
        const duration = convertSecondsTohhmmss(d)
        return invokeEncodeLambdaFunction(bucket, videoKey, startTime, duration, String(idx))
    })

    const m3u8_list = await Promise.all(p)
    const parsed_m3u8_list = m3u8_list.map(parseM3U8)
    const m3u8 = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        `#EXT-X-TARGETDURATION:${Math.ceil(parsed_m3u8_list.reduce((max, { targetDuration }) => Math.max(targetDuration, max), 0))}`,
        '#EXT-X-MEDIA-SEQUENCE:0',
        ...parsed_m3u8_list.map(({ lines }, idx) => idx == 0 ? lines : ['#EXT-X-DISCONTINUITY', ...lines]).flat(),
        '#EXT-X-ENDLIST'
    ].join('\n') + '\n'

    const m3u8Key = path.join(...videoKey.split('/').slice(0, -1), 'index.m3u8')
    console.info(`m3u8 파일 생성 및 업로드 시작 ${m3u8Key}`)
    await s3.putObject({
        Bucket: bucket,
        Key: m3u8Key,
        Body: Buffer.from(m3u8),
        ContentType: 'application/x-mpegURL'
    }).promise()
    console.info(`m3u8 파일 생성 및 업로드 완료 ${m3u8Key}`)

    // workingState.delete(key)
}


const spawnFFMpeg = () => {
    const ffmpeg_process = spawn(ffmpegPath, [
        '-i', '-'
    ])

    return ffmpeg_process
}

export const getVideoLength = (videoStream: Readable) => {
    return new Promise<number>((resolve, reject) => {
        const ffmpeg_process = spawnFFMpeg()

        const chunks: Buffer[] = []
        ffmpeg_process.stderr.on('data', (chunk) => {
            chunks.push(chunk)
        })
        ffmpeg_process.stderr.on('end', () => {
            const str = Buffer.concat(chunks).toString()
            if(str.match(/Duration: (\d+:\d+:\d+.\d+),/)) {
                const [, hour, minute, second, frame] = str.match(/Duration: (\d+):(\d+):(\d+).(\d+),/)
                resolve(Number(hour) * 60 * 60 + Number(minute) * 60 + Number(second))
            } else {
                console.error('get video length 실행 중 에러')
                reject(new Error('duration 을 읽을 수 없습니다.'))
            }
        })
        ffmpeg_process.stderr.on('error', (e) => {
            reject(e)
        })
        ffmpeg_process.on('error', (e)=>{
            reject(e)
        })

        ffmpeg_process.stdin.on('error', (err: any) => {
            if (['ECONNRESET', 'EPIPE', 'EOF'].indexOf(err.code) >= 0) { return; }
            console.warn('ffmpeg stdin 입력중 에러')
        })
        ffmpeg_process.stdin.on('close', () => {
            videoStream.pause()
            videoStream.unpipe(ffmpeg_process.stdin)
        })

        videoStream.pipe(ffmpeg_process.stdin)
    })
}