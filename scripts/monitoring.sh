#!/bin/bash

set -e

apt -y install sysstat

sed -i 's/ENABLED="false"/ENABLED="true"/g' /etc/default/sysstat

echo '# The first element of the path is a directory where the debian-sa1
# script is located
PATH=/usr/lib/sysstat:/usr/sbin:/usr/sbin:/usr/bin:/sbin:/bin

# Activity reports
# Run system activity accounting tool every 5 minutes
# Takes a sample every second for 10 seconds
# -D: use full mmddYYYY names, XDISK: detailed disk/fs info
# These samples go to /var/log/sysstat
5-55/5 * * * * root command -v debian-sa1 > /dev/null && debian-sa1 1 10 -D

# Additional run at 23:59 to rotate the statistics file
59 23 * * * root command -v debian-sa1 > /dev/null && debian-sa1 60 2 -D

# Generate a daily summary of process accounting at 23:55
# These summaries go to /var/log/sysstat
55 23 * * * root command -v sa2 > /dev/null && sa2 -A -D
' > /etc/cron.d/sysstat
chown root:root /etc/cron.d/sysstat
chmod o-rwx /etc/cron.d/sysstat

systemctl restart sysstat
