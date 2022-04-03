import type { Readable } from 'stream'
import { PassThrough } from 'stream'
import S3 from 'aws-sdk/clients/s3'
import { logger } from '../utils/logger'

export interface S3Context {
    s3: S3
    bucket: string
}

const s3 = new S3({
    credentials: process.env.S3_ACCESS_KEY_ID ? {
        accessKeyId: process.env.S3_ACCESS_KEY_ID,
        secretAccessKey: process.env.S3_SECRET
    } : null,
    region: 'ap-northeast-2'
})

export const getS3Context = (): S3Context => ({
    s3, bucket: process.env.S3_BUCKET
})

export const listObject = async ({ s3, bucket }: S3Context, prefix: string) => {
    try{
        const res = await s3.listObjectsV2({
            Bucket: bucket,
            Prefix: prefix
        }).promise()
    
        return res.Contents
    } catch(err){
        logger.error(err)
        throw err
    }
}

export const getObjectReadStream = ({ s3, bucket }: S3Context, key: string) => {
    return new Promise<Readable>((resolve, reject) => {
        const stream = s3.getObject({
            Bucket: bucket,
            Key: key,
        }).createReadStream();
    
        stream.on('readable', () => resolve(stream))
        stream.on('error', (e) => {
            reject(e)
        })
    })
}

export const getObject = async ({ s3, bucket }: S3Context, key: string) => {
    const res = await s3.getObject({
        Bucket: bucket,
        Key: key,
    }).promise();
    
    return res.Body as Buffer
}

export const getObjectWriteStream = ({ s3, bucket }: S3Context, key: string) => {
    const pass = new PassThrough()

    const promise = s3.upload({
        Bucket: bucket,
        Key: key,
        Body: pass
    }).promise()

    return {
        stream: pass, promise
    }
}

export const putObject = async ({ s3, bucket }: S3Context, key: string, body: Buffer, contentType: string) => {
    const res = await s3.putObject({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType
    }).promise()

    return res
}

export const listSubDirectories = async ({ s3, bucket }: S3Context, prefix: string) => {
    if(prefix.endsWith('/') == false) {
        throw new Error('listSubDirectories prefix 는 /로 끝나야 합니다.')
    }
    
    try{
        const res = await s3.listObjectsV2({
            Bucket: bucket,
            Prefix: prefix,
            Delimiter: '/'
        }).promise()

        return res.CommonPrefixes.map(el => el.Prefix)
    } catch(err){
        logger.error(err)
        throw err
    }
}