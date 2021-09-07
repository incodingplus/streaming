import fs from 'fs'

export const loadEnv = (envPath: string) => {
    try{
        const data: Record<string, any> = JSON.parse(fs.readFileSync(envPath, { encoding: 'utf-8' }))
        for(const [k, v] of Object.entries(data)) {
            process.env[k] = String(v)
        }
        
        return true
    } catch(err){
        console.error(`loadEnv 에러 ${err.message}`)
        return false
    }
}