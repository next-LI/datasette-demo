## BEGIN upstream datasette Dockerfile ##
# NOTE: until https://github.com/simonw/datasette/issues/1320 is resolved, we have to
# use this modified version of the datasetteproj/datasette base docker image

FROM python:3.9.2-slim-buster as base

# Version of Datasette to install, e.g. 0.55
#   docker build . -t datasette --build-arg VERSION=0.55

# software-properties-common provides add-apt-repository
# which we need in order to install a more recent release
# of libsqlite3-mod-spatialite from the sid distribution
RUN apt-get update && \
    apt-get -y --no-install-recommends install software-properties-common && \
    add-apt-repository "deb http://httpredir.debian.org/debian sid main" && \
    apt-get update && \
    apt-get -t sid install -y --no-install-recommends \
        libsqlite3-mod-spatialite git ssh curl xz-utils git && \
    apt-get remove -y software-properties-common && \
    apt clean && \
    rm -rf /var/lib/apt && \
    rm -rf /var/lib/dpkg/info/* 

## END upstream datasette Dockerfile ##

RUN apt-get update && apt-get install -y 

RUN pip3 install git+https://github.com/next-LI/datasette.git

RUN datasette install csvs-to-sqlite datasette-auth-github datasette-leaflet datasette-leaflet-geojson datasette-leaflet-freedraw datasette-export-notebook datasette-configure-fts datasette-render-images datasette-vega datasette-show-errors datasette-saved-queries datasette-geojson datasette-geojson-map
RUN datasette install git+https://github.com/next-LI/datasette-csv-importer.git
RUN datasette install git+https://github.com/next-LI/datasette-live-permissions.git
RUN datasette install git+https://github.com/next-LI/datasette-live-config.git
RUN datasette install git+https://github.com/next-LI/datasette-surveys.git

FROM base as datasette

WORKDIR /datasette
EXPOSE 8000
VOLUME /datasette
CMD /usr/local/bin/datasette  serve . --load-extension=spatialite --setting default_page_size 25 --metadata config/metadata.yml -h 0.0.0.0 -p 8000
