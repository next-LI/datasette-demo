DEMO_USER=datasette
SUDO_USER=$$(whoami)
DEMO_VM_NAME=$${DEMO_VM_NAME}
DEMO_PROJECT_ID=$${DEMO_PROJECT_ID}
HOST=datasette-live.bxroberts.org

ssh:
	ssh ${SUDO_USER}@${HOST}

gcloud_ssh:
	gcloud beta compute ssh --zone "us-central1-a" ${DEMO_VM_NAME} --project ${PROJECT_ID}

deploy:
	# this has to be done separate .... doesn't come with rsync :(
	ssh ${SUDO_USER}@${HOST} sudo apt install rsync
	# then we push all the files and deploy script
	rsync --progress -avu -C \
		--exclude '*.db' \
		--exclude '.*.swp' \
		--exclude data/ \
		--exclude csvs/ \
		./ ${DEMO_USER}@${HOST}:/home/${DEMO_USER}/demo-upload
	# then we run the local deploy script
	ssh ${SUDO_USER}@${HOST} -- sudo /home/${DEMO_USER}/demo-upload/deploy.sh

serve:
	datasette serve --root --load-extension=spatialite --metadata config/metadata.yml . -h 127.0.0.1 -p 8000

##################
# G E T  D A T A #
##################

## Mapping-related Datasets

# Census Bureau Congressional District Shapefiles
data/cd:
	mkdir -p data/cd

data/cd/tl_2020_us_cd116.zip: data/cd
	cd data/cd \
		&& wget -nc https://www2.census.gov/geo/tiger/TIGER2020/CD/tl_2020_us_cd116.zip \
		&& unzip -n tl_2020_us_cd116.zip
districts: data/cd/tl_2020_us_cd116.zip
	shapefile-to-sqlite --spatialite --spatial-index \
		--table 2020_congressioinal_districts congressional_districts.db \
		data/cd/tl_2019_us_cd116.shp

# states for the districts (join on statefp)
data/cd/tl_2020_us_state.zip:
	cd data/cd \
		&& wget -nc https://www2.census.gov/geo/tiger/TIGER2020/STATE/tl_2020_us_state.zip \
		&& unzip -n tl_2020_us_state.zip
states: data/cd/tl_2020_us_state.zip
	dbf-to-sqlite --table states \
		data/cd/tl_2020_us_state.dbf congressional_districts.db

congressional_districts.db: districts states

# NY Electoral Districts
ny_electoral_districts.db:
	mkdir -p data/ny-electoral \
		&& unzip -n data/all_eds_all_eds_shp.zip -d data/ny-electoral/
	shapefile-to-sqlite --table ny_electoral_districts \
		ny_electoral_districts.db data/ny-electoral/all_eds_all_eds_shp.shp

## Text-heavy Datasets

# ProPublica Congressional Bills
PP_DATA_FIELDS='sponsor.name,sponsor.title,sponsor.state,subjects,subjects_top_term,summary.as,summary.text,summary.date,updated_at,url,status,status_at,official_title,popular_title,short_title,related_bills,number,introduced_at'
congressional_bills.db:
	@which json2csv || (echo "json2csv missing! Get it here: https://github.com/jehiah/json2csv" && exit 1)
	mkdir -p data/congress
	cd data/congress \
	    && wget -nc https://s3.amazonaws.com/pp-projects-static/congress/bills/116.zip \
	    && wget -nc https://s3.amazonaws.com/pp-projects-static/congress/bills/115.zip \
	    && unzip -n 115.zip \
	    && unzip -n 116.zip
	echo ${PP_DATA_FIELDS} > data/congressional_bills.csv
	cat data/congress/115/bills/*/*/data.json | jq -c '.' \
		| json2csv -k ${PP_DATA_FIELDS} \
		| tee -a data/congressional_bills.csv
	cat data/congress/116/bills/*/*/data.json | jq -c '.' \
		| json2csv -k ${PP_DATA_FIELDS} \
		| tee -a data/congressional_bills.csv
	csvs-to-sqlite --table congressional_bills \
		data/congressional_bills.csv congressional_bills.db

proposed_gunlaws.db:
	csvs-to-sqlite --table gunlaws data/20180926_gunlaws.csv proposed_gunlaws.db

databases: congressional_districts.db proposed_gunlaws.db congressional_bills.db ny_electoral_districts.db 
	sqlite-utils optimize *.db

clean:
	rm -f congressional_districts.db proposed_gunlaws.db congressional_bills.db ny_electoral_districts.db
