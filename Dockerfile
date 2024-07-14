FROM nginx:latest
COPY ./praise /usr/share/nginx/html/
COPY ./nginx/default.conf /etc/nginx/conf.d/
EXPOSE 80