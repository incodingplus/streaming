import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    res.sendFile('index.html', {
        root:'./view'
    });
});

router.get('/check', (req, res) => {   //서버 코드
    const token = req.query.token;
    if(token === 'good'){
        res.end('good')
    } else {
        res.end('bad');
    }
});


router.post('/howlong', (req, res) => {
    console.log(req.body);
});

export default router;