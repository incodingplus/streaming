#!/bin/bash

npx webpack
cd dist_webpack && zip -r ../lambda.zip ./* && cd ..

aws lambda update-function-code \
    --region ap-northeast-2 \
    --profile incoding \
    --function-name  split_video_into_ts \
    --zip-file fileb://lambda.zip

rm lambda.zip