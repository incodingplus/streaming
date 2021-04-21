FROM node:latest

RUN apt-get update
RUN apt-get -y upgrade
RUN apt-get install -y git

RUN npm i -g npm
RUN npm i -g nodemon
RUN npm i -g concurrently
RUN npm i -g typescript

WORKDIR /usr/src/app

RUN mkdir /usr/src/script

ADD ./docker.sh /usr/src/script/docker.sh

RUN chmod 777 /usr/src/script/docker.sh

ENTRYPOINT ["/usr/src/script/docker.sh"]

EXPOSE 5000

# CMD [ "node", "dist/index.js" ]