FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY app.js /usr/share/nginx/html/app.js
COPY state.js /usr/share/nginx/html/state.js
COPY views.js /usr/share/nginx/html/views.js

EXPOSE 80
