import { setToBase, makeHash } from './algorithm';
import { tokens } from './token'

export const validateToken = (req, res, next) => {
    if(req.query.token){
        next();
    } else {
        res.status(404);
        res.end('token이 빠져있음');
    }
}

export const validateHash = (req, res, next) => {
    if(req.query.time && req.query.token){
        const tk = req.query.token as string;
        const time = req.query.time as string;
        const hash = makeHash(tk, time);
        if(tokens.has(hash)){
            next();
        } else {
            res.status(404);
            res.end('잘못된 토큰');
        }
    } else {
        res.status(404);
        res.end('time, token이 빠져있음');
    }
}

export const validateURL = (req, res, next) => {
    if(req.query.url){
        const raw = req.query.url as string;
        if(raw.search(/\.temp$/) === -1){
            next();
        } else {
            res.status(404);
            res.end('잘못된 url');
        }
    } else {
        res.status(404);
        res.end('url이 빠져있음');
    }
}