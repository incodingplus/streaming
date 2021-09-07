import crypto from 'crypto';
import { HowLong } from './type.js';

const b64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export const setToBase = ({ set, length, files }: Pick<HowLong, 'set'|'length'|'files'>):string => {
    const arr:number[] = Array(Math.ceil(length / 6) * 6).fill(0);
    const result:string[] = [];
    for(let i of set){
        if(/\.ts$/.test(i) == false) continue

        const idx = files.findIndex(f => f === i)
        if(idx != -1 && idx < arr.length) arr[idx] = 1
    }
    let k:number = 0;
    for(let i = 0; i < arr.length; i++){
        k = 2 * k + arr[i];
        if(i % 6 === 5){
            result.push(b64[k]);
            k = 0;
        }
    }
    return result.join('');
};

export const binToBase = (arr:number[]):string => {
    arr.push(...Array(6 - ((arr.length + 5) % 6 + 1)).fill(0));
    const result:string[] = [];
    let k:number = 0;
    for(let i = 0; i < arr.length; i++){
        k = 2 * k + arr[i];
        if(i % 6 === 5){
            result.push(b64[k]);
            k = 0;
        }
    }
    return result.join('');
};

export const baseToBin = (str:string):number[] => {
    const arr:number[] = [];
    for(let i = 0; i < str.length; i++){
        let num = b64.indexOf(str[i]);
        for(let j = 0; j < 6; j++){
            const n = num % 2;
            arr[(i + 1) * 6 - j - 1] = n;
            num = Math.floor(num / 2);
        }
    }
    return arr;
}

export const makeHash = (...token:string[]) => {
    const secret = 'rockman';
    return crypto.createHmac('sha256', secret).update(token.join('')).digest('hex');
};