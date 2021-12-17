
export type EncodeVideoArgs = {
    bucket: string

    /** videos/{token}/{filename} */
    videoKey: string
    /** HH:mm:ss */
    startTime: string
    /** HH:mm:ss */
    duration: string

    /** ts 파일 suffix 번호 */
    tsSubSuffix: string
}

export type SplitJobArgs = {
    bucket: string
    videoKey: string
}