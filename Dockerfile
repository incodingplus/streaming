FROM ubuntu:latest

RUN apt-get update
RUN apt-get -y upgrade
RUN apt-get install -y nodejs
RUN apt-get install -y git
RUN apt-get install -y certbot

WORKDIR /usr/src/app

# COPY package*.json ./

# RUN npm install

# COPY . .

ENTRYPOINT ["/bin/bash", "-c" , "git config --global user.email \"myrlagksruf@gmail.com\" && git config --global user.name \"myrlagksruf\" && /bin/bash"]

EXPOSE 5000

# CMD [ "node", "dist/index.js" ]