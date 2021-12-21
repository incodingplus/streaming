import type { SplitJobArgs } from '../types'
import { Lambda } from 'aws-sdk'
import { logger } from '../utils/logger'

type WorkingState = {
    key: string,
    status: 'finish'|'error'|'start'
}

const workingState = new Map<string, WorkingState>();

const lambda = new Lambda({
    region: 'ap-northeast-2',
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET
    },
    httpOptions: {
        timeout: 1000 * 60 * 15,
    }
})

export const invokeEncodeLambdaFunction = async (bucket: string, key: string) => {

    workingState.set(key, {
        key, status: 'start'
    })

    logger.info(`인코딩 함수 호출 시작 ${key}`)
    const res = await lambda.invoke({
        FunctionName: 'split_video_encode_jobs',
        Payload: JSON.stringify(<SplitJobArgs>{
            bucket,
            videoKey: key,
        }),
    }).promise()
    
    if(!(200 <= res.StatusCode && res.StatusCode < 300)) {
        workingState.set(key, {
            key, status: 'error'
        })
        logger.error('encode lambda function 호출 중 에러')
        console.error(res.$response.error)
        return false
    }
    workingState.delete(key)
    logger.info(`인코딩 함수 호출 성공 ${key}`)
    return true
}

export const isInEncoding = (key: string) => {
    return workingState.has(key)
}

export const encodingList = () => {
    return [...workingState.values()]
}
