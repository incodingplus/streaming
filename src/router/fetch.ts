import fetch from 'node-fetch'

export const post = (url: string, body: Record<string, any>) => {
    return fetch(
        url, 
        {
            method: 'POST',
            headers: {
                'Content-Type':'application/json'
            },
            body: JSON.stringify(body)
        }
    )
}

export const get = (url: string) => {
    return fetch(
        url, 
        {
            method: 'GET',
            headers: {
                'Content-Type':'application/json'
            }
        }
    )
}