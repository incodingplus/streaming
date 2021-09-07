import { S3 } from 'aws-sdk'
import { spawn, execSync } from 'child_process'
import path from 'path'
import crypto from 'crypto'
import fs from 'fs'

const s3 = new S3({
    region: 'ap-northeast-2',
    credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET_KEY
    }
})

const ffmpegPath = '/opt/bin/ffmpeg'
// const ffmpegPath = '/opt/homebrew/bin/ffmpeg'

// class OutputParser {
//     state: 'm3u8'|'ts'|''
//     ts_num: number
//     m3u8_file: Buffer[]
//     ts_files: Buffer[][]

//     constructor(){
//         this.state = ''
//         this.ts_num = -1

//         this.m3u8_file = []
//         this.ts_files = []
//     }

//     update(buf: Buffer){

//         if(this.ts_num === -1){
//             console.log(buf.slice(0, 4).toString('hex'))
//         }

//         if(buf.slice(0, 2).toString('hex') === '4740') {
//             // ts header detect
//             console.debug('buffer update ts header detect')
            
//             this.state = 'ts'
//             this.ts_num += 1

//             this.ts_files[this.ts_num] = []

//         } else if (buf.slice(0, 4).toString('hex') === '23455854') {
//             // m3u8 header detect
//             console.debug('buffer update m3u8 header detect')

//             this.state = 'm3u8'

//             this.m3u8_file = []
//         }

//         if(this.state === 'm3u8') {
//             this.m3u8_file.push(buf)
//         } else if(this.state === 'ts') {
//             this.ts_files[this.ts_num].push(buf)
//         }
//     }

//     digest(){
//         const ts_files: Buffer[] = this.ts_files.map(
//             ts_file => Buffer.concat(ts_file)
//         )

//         const m3u8_buf = Buffer.concat(this.m3u8_file)
//         console.log(m3u8_buf.toString())
//         const extinfs = m3u8_buf.toString().split('\n').filter(el => /^#EXTINF/.test(el))
//         const video_lengths = extinfs.map(
//             str => str.match(/^#EXTINF:(.*),$/)[1]
//         )

//         if(video_lengths.length !== ts_files.length) {
            
//             // ffprobe
//         }

//         return {
//             ts_files, video_lengths
//         }
//     }
// }

type EncodeVideoArgs = {
    /** videos/{token}/{filename} */
    videoKey: string
    /** HH:mm:ss */
    startTime: string
    /** HH:mm:ss */
    duration: string

    /** ts 파일 suffix 번호 */
    tsSubSuffix: string
}
export const encodeVideo = async ({ videoKey, startTime, duration, tsSubSuffix }: EncodeVideoArgs) => {
    
    console.log({ videoKey, startTime, duration, tsSubSuffix })

    const stream = s3.getObject({
        Bucket: process.env.S3_BUCKET,
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
    
        // const parser = new OutputParser()
    
        // mpeg_process.stdout.on('data', (chunk) => {
        //     parser.update(chunk)
        // })
        // mpeg_process.stdout.on('end', () => {
        //     const { ts_files, video_lengths } = parser.digest()
        //     resolve({ ts_files, video_lengths })

        //     console.timeEnd('ENCODING')
        // })
        // mpeg_process.on('error', (e) => {
        //     reject(e)
        // })
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

        await s3.putObject({
            Bucket: process.env.S3_BUCKET,
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
