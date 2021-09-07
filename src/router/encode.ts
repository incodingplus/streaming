import path from 'path'
import { Lambda } from 'aws-sdk'
import { putObject } from './s3'

type WorkingState = {
    key: string
    total_count: number
    finished_count: number
    durations: number[]
}

const workingState = new Map<string, WorkingState>();

const lambda = new Lambda({
    region: 'ap-northeast-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET
    }
})

type EncodeMetadata = {
    // duration in seconds
    duration: number;

    // s3 video key
    key: string;
}

type Response = {
    // m3u8 data in hex
    m3u8: string
}
const invokeEncodeLambdaFunction = async (key: string, startTime: string, duration: string, tsSubSuffix: string) => {

    console.info(`인코딩 함수 호출 시작 ${key} ${startTime} - ${duration}`)
    const res = await lambda.invoke({
        FunctionName: 'split_video_into_ts',
        Payload: JSON.stringify({
            videoKey: key,
            startTime,
            duration,
            tsSubSuffix
        })
    }).promise()

    const state = workingState.get(key)
    state.finished_count += 1
    console.info(`인코딩 함수 호출 완료 ${key} ${startTime} - ${duration}`)

    if(!(200 <= res.StatusCode && res.StatusCode < 300)) {
        console.error('encode lambda function 호출 중 에러')
        console.error(res.$response.error)
        throw res.$response.error
    }

    const { m3u8 } = JSON.parse(res.Payload.toString()) as Response
    return Buffer.from(m3u8, 'hex').toString()
}

const convertSecondsTohhmmss = (seconds: number) => {
    const hh = Math.floor(seconds / 3600).toString().padStart(2, '0')
    const mm = Math.floor(seconds / 60).toString().padStart(2, '0')
    const ss = Math.floor(seconds % 60).toString().padStart(2, '0')
    return `${hh}:${mm}:${ss}`
}

const parseM3U8 = (m3u8: string) => {
    const lines = m3u8.split('\n').filter(el => el.trim() !== '')
    
    const targetDuration = Number(lines.find(el => /#EXT-X-TARGETDURATION/.test(el)).match(/^#EXT-X-TARGETDURATION:(\d+)$/)[1])
    
    return {
        lines: lines.slice(4, -1),
        targetDuration
    }
}

export const startEncode = async ({ duration, key }: EncodeMetadata) => {
    
    console.info(`영상 ${key} 인코딩 시작 (duration: ${duration})`)

    const durations = []
    while(duration > 0) {
        // 6분씩 추가
        durations.push(Math.min(duration, 60 * 6))
        duration -= Math.min(duration, 60 * 6)
    }

    workingState.set(key, {
        key, finished_count: 0, total_count: durations.length, durations
    })

    if(durations.length == 0) {
        console.error(`영상 ${key} durations 개수가 0 이라 인코딩 중지`)
        return
    }

    console.info(`영상 ${key} durations: ${durations}`)

    // 마지막 시간이 3분 미만이면 앞 시간에 추가
    if(durations.length > 1 && durations[durations.length - 1] < 60 * 3) {
        durations[durations.length - 2] += durations[durations.length - 1]
        durations.pop()
    }

    const p = durations.map((d, idx) => {
        const startTime = convertSecondsTohhmmss(durations.slice(0, idx).reduce((sum, el) => el + sum, 0))
        const duration = convertSecondsTohhmmss(d)
        return invokeEncodeLambdaFunction(key, startTime, duration, String(idx))
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

    const m3u8Key = path.join(...key.split('/').slice(0, -1), 'index.m3u8')
    console.info(`m3u8 파일 생성 및 업로드 시작 ${m3u8Key}`)
    await putObject(m3u8Key, Buffer.from(m3u8), 'application/x-mpegURL')
    console.info(`m3u8 파일 생성 및 업로드 완료 ${m3u8Key}`)

    workingState.delete(key)
}

export const isInEncoding = (key: string) => {
    return workingState.has(key)
}

export const encodingList = () => {
    return [...workingState.values()]
}