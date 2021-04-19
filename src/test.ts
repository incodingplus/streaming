import express from 'express';
import { tokens } from './main.js';
const router = express.Router();

router.post('/howlong', (req, res) => {
    console.log(req.body);
    res.end('잘옴');
});

//token 체크
router.use('/', (req, res, next) => {
    if(req.query.token){
        next();
    } else {
        res.redirect('/video/error');
    }
})

router.get('/', (req, res) => {
    if(tokens.has(req.query.token as string)){
        res.sendFile('index.html', {
            root:'./view'
        });
    } else {
        res.status(404);
        res.redirect('video/error');
    }
});

router.get('/check', (req, res) => {   //서버 코드
    const token = req.query.token;
    if(token === 'good'){
        res.end('good')
    } else {
        res.end('bad');
    }
});

export default router;