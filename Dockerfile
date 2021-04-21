FROM ubuntu:latest

RUN apt-get update
RUN apt-get -y upgrade
RUN apt-get install -y nodejs
RUN apt-get install -y git

WORKDIR /usr/src/app

# COPY package*.json ./

# RUN npm install

# COPY . .

EXPOSE 5000

# CMD [ "node", "dist/index.js" ]