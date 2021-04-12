#!/bin/bash
DEPLOY_DIR=/home/datasette/demo-upload
WORKDIR=/home/datasette/datasette-root
USER=datasette

# try to source the env.sh if the vars aren't set
source ${DEPLOY_DIR}/secrets/env.sh

if  [ ! -f ${DEPLOY_DIR}/secrets/env.sh ] || \
    [ -z ${DEMO_DATASETTE_SECRET} ] || \
    [ -z ${DEMO_GITHUB_CLIENT_ID} ] || \
    [ -z ${DEMO_GITHUB_CLIENT_SECRET} ]; then
    echo "ERROR: You need to set the deploy secrets envinroment variables: DEMO_DATASETTE_SECRET, DEMO_GITHUB_CLIENT_ID, DEMO_GITHUB_CLIENT_SECRET"
    echo "Add your credentials to the secrets/env.sh file. You can use ./secrets/env.template.sh as a base, fill in the variables secrets, copy it to secrets/env.sh and then try to run this again."
    exit 1
fi

set -e

if ! id ${USER} 2> /dev/null; then
    useradd -d /home/${USER} --create-home --user-group ${USER}
fi

# Setup system monitoring
${DEPLOY_DIR}/scripts/monitoring.sh

mkdir -p ${WORKDIR}
mv -f ${DEPLOY_DIR}/config/metadata.yml ${WORKDIR}/
mkdir -p ${WORKDIR}/plugins
mv -f ${DEPLOY_DIR}/plugins/* ${WORKDIR}/plugins/
mkdir -p ${WORKDIR}/static/
rsync -av ${DEPLOY_DIR}/static/ ${WORKDIR}/static/
# add --delete here to clear data every deploy
# rsync -av ${DEPLOY_DIR}/*.db ${WORKDIR}/
chown -R ${USER}:${USER} ${WORKDIR}
mkdir -p ${WORKDIR}/csvs

apt-get update -y
apt-get install -y python3 python3-pip git nginx libsqlite3-mod-spatialite

#pip3 install datasette
pip3 install git+https://github.com/next-LI/datasette.git

# wipe unused/uninstalled plugins
pip3 uninstall --yes $(pip3 list | grep -e '^datasette\-'| awk '{print $1}')
# .. then (re)install them
datasette install csvs-to-sqlite datasette-auth-github datasette-leaflet datasette-leaflet-geojson datasette-leaflet-freedraw datasette-export-notebook  datasette-configure-fts datasette-render-images datasette-vega datasette-show-errors datasette-saved-queries
datasette install git+https://github.com/next-LI/datasette-search-all.git
datasette install git+https://github.com/next-LI/datasette-csv-importer.git
datasette install git+https://github.com/next-LI/datasette-live-permissions.git
datasette install git+https://github.com/next-LI/datasette-live-config.git
datasette install git+https://github.com/next-LI/datasette-surveys.git

echo "
# /etc/crontab: system-wide crontab
# Unlike any other crontab you don't have to run the crontab
# command to install the new version when you edit this file
# and files in /etc/cron.d. These files also have username fields,
# that none of the other crontabs do.

SHELL=/bin/sh
PATH=/usr/local/sbin:/usr/local/bin:/sbin:/bin:/usr/sbin:/usr/bin

# Example of job definition:
# .---------------- minute (0 - 59)
# |  .------------- hour (0 - 23)
# |  |  .---------- day of month (1 - 31)
# |  |  |  .------- month (1 - 12) OR jan,feb,mar,apr ...
# |  |  |  |  .---- day of week (0 - 6) (Sunday=0 or 7) OR sun,mon,tue,wed,thu,fri,sat
# |  |  |  |  |
# *  *  *  *  * user-name command to be executed
17 *    * * *   root    cd / && run-parts --report /etc/cron.hourly
25 6    * * *   root    test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.daily )
47 6    * * 7   root    test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.weekly )
52 6    1 * *   root    test -x /usr/sbin/anacron || ( cd / && run-parts --report /etc/cron.monthly )

0  12   * * *   root    /usr/bin/certbot renew --quiet
" > /etc/crontab

echo "
[Unit]
Description=Datasette
After=network.target

[Service]
Type=simple
User=${USER}
Environment=DATASETTE_SECRET=${DEMO_DATASETTE_SECRET}
Environment=GITHUB_CLIENT_ID=${DEMO_GITHUB_CLIENT_ID}
Environment=GITHUB_CLIENT_SECRET=${DEMO_GITHUB_CLIENT_SECRET}
WorkingDirectory=${WORKDIR}
ExecStart=datasette serve . --root --load-extension=spatialite -h 127.0.0.1 -p 8000
Restart=on-failure

[Install]
WantedBy=multi-user.target
" > /etc/systemd/system/datasette.service

systemctl daemon-reload
systemctl restart datasette.service
systemctl enable datasette.service

echo 'server {
    listen 80 default_server;
    listen [::]:80 default_server;

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/datasette-live.bxroberts.org/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/datasette-live.bxroberts.org/privkey.pem; # managed by Certbot

    # Redirect non-https traffic to https
    if ($scheme != "https") {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    client_max_body_size 0;

    location / {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
    }
}' > /etc/nginx/sites-available/datasette.conf
rm -f /etc/nginx/sites-enabled/*
ln -s /etc/nginx/sites-available/datasette.conf /etc/nginx/sites-enabled/
systemctl restart nginx
