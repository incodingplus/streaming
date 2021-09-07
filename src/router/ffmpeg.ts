import { spawn } from 'child_process'
import { Readable } from 'stream'

const FFMpegPath = process.env.FFMPEG_PATH

const spawnFFMpeg = () => {
    const ffmpeg_process = spawn(FFMpegPath, [
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

        ffmpeg_process.stdin.on('error', () => {
            console.warn('ffmpeg stdin 입력중 에러')
        })

        videoStream.pipe(ffmpeg_process.stdin)
    })
}