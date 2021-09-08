import type { Readable } from 'stream'
import { PassThrough } from 'stream'
import S3 from 'aws-sdk/clients/s3'
import { logger } from '../utils/logger'

const s3 = new S3({
    credentials: process.env.S3_ACCESS_KEY_ID ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET
    } : null,
    region: 'ap-northeast-2'
})

export const listObject = async (prefix: string) => {
    try{
        const res = await s3.listObjectsV2({
            Bucket: process.env.S3_BUCKET,
            Prefix: prefix
        }).promise()
    
        return res.Contents
    } catch(err){
        logger.error(err)
        throw err
    }
}

export const getObjectReadStream = (key: string) => {
    return new Promise<Readable>((resolve, reject) => {
        const stream = s3.getObject({
            Bucket: process.env.S3_BUCKET,
            Key: key,
        }).createReadStream();
    
        stream.on('readable', () => resolve(stream))
        stream.on('error', (e) => {
            reject(e)
        })
    })
}

export const getObject = async (key: string) => {
    const res = await s3.getObject({
        Bucket: process.env.S3_BUCKET,
        Key: key,
    }).promise();
    
    return res.Body as Buffer
}

export const getObjectWriteStream = (key: string) => {
    const pass = new PassThrough()

    const promise = s3.upload({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: pass
    }).promise()

    return {
        stream: pass, promise
    }
}

export const putObject = async (key: string, body: Buffer, contentType: string) => {
    const res = await s3.putObject({
        Bucket: process.env.S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType
    }).promise()

    return res
}

export const listSubDirectories = async (prefix: string) => {
    if(prefix.endsWith('/') == false) {
        throw new Error('listSubDirectories prefix 는 /로 끝나야 합니다.')
    }
    
    try{
        const res = await s3.listObjectsV2({
            Bucket: process.env.S3_BUCKET,
            Prefix: prefix,
            Delimiter: '/'
        }).promise()

        return res.CommonPrefixes.map(el => el.Prefix)
    } catch(err){
        logger.error(err)
        throw err
    }
}