## Experiment One

Datasette env setup:

    RUN datasette install csvs-to-sqlite datasette-auth-github datasette-leaflet datasette-leaflet-geojson datasette-leaflet-freedraw datasette-export-notebook datasette-configure-fts datasette-render-images datasette-vega datasette-show-errors datasette-saved-queries datasette-geojson datasette-geojson-map
    RUN datasette install git+https://github.com/next-LI/datasette-search-all.git
    RUN datasette install git+https://github.com/next-LI/datasette-csv-importer.git
    RUN datasette install git+https://github.com/next-LI/datasette-live-permissions.git
    RUN datasette install git+https://github.com/next-LI/datasette-live-config.git
    RUN datasette install git+https://github.com/next-LI/datasette-surveys.git

```
$ ab -n 1000 -c 10 http://localhost:8000/
This is ApacheBench, Version 2.3 <$Revision: 1879490 $>
Copyright 1996 Adam Twiss, Zeus Technology Ltd, http://www.zeustech.net/
Licensed to The Apache Software Foundation, http://www.apache.org/

Benchmarking localhost (be patient)
Completed 100 requests
Completed 200 requests
Completed 300 requests
Completed 400 requests
Completed 500 requests
Completed 600 requests
Completed 700 requests
Completed 800 requests
Completed 900 requests
Completed 1000 requests
Finished 1000 requests


Server Software:        uvicorn
Server Hostname:        localhost
Server Port:            8000

Document Path:          /
Document Length:        4579 bytes

Concurrency Level:      10
Time taken for tests:   850.755 seconds
Complete requests:      1000
Failed requests:        0
Total transferred:      4711000 bytes
HTML transferred:       4579000 bytes
Requests per second:    1.18 [#/sec] (mean)
Time per request:       8507.552 [ms] (mean)
Time per request:       850.755 [ms] (mean, across all concurrent requests)
Transfer rate:          5.41 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.0      0       0
Processing:   773 8471 1719.6   8271   17197
Waiting:      773 7572 1616.3   7900   17197
Total:        773 8471 1719.6   8271   17197

Percentage of the requests served within a certain time (ms)
  50%   8271
  66%   8802
  75%   9160
  80%   9441
  90%  10393
  95%  11507
  98%  13002
  99%  14129
 100%  17197 (longest request)
```

Conclusion: `datasette-search-all` is a *very* slow plugin!!

## Experiment Two

I removed the `datasette-search-all` plugin. Just at a glance, it's MUCH faster now.

Datasette env setup:

    RUN datasette install csvs-to-sqlite datasette-auth-github datasette-leaflet datasette-leaflet-geojson datasette-leaflet-freedraw datasette-export-notebook datasette-configure-fts datasette-render-images datasette-vega datasette-show-errors datasette-saved-queries datasette-geojson datasette-geojson-map
    RUN datasette install git+https://github.com/next-LI/datasette-csv-importer.git
    RUN datasette install git+https://github.com/next-LI/datasette-live-permissions.git
    RUN datasette install git+https://github.com/next-LI/datasette-live-config.git
    RUN datasette install git+https://github.com/next-LI/datasette-surveys.git


```
$ ab -C ds_actor=eyJhIjp7ImlkIjoicm9vdCJ9fQ.uqMeJYyoABmdUb5kUg0KwXM1si0 -C ds_csrftoken=Ik41YmxBZ0Y5UnNaYUlwd28i.aek0OomAb1_1o65NRcurlO1SU0c -n 1000 -c 10 http://127.0.0.1:8000/
This is ApacheBench, Version 2.3 <$Revision: 1879490 $>
Copyright 1996 Adam Twiss, Zeus Technology Ltd, http://www.zeustech.net/
Licensed to The Apache Software Foundation, http://www.apache.org/

Benchmarking 127.0.0.1 (be patient)
Completed 100 requests
Completed 200 requests
Completed 300 requests
Completed 400 requests
Completed 500 requests
Completed 600 requests
Completed 700 requests
Completed 800 requests
Completed 900 requests
Completed 1000 requests
Finished 1000 requests


Server Software:        uvicorn
Server Hostname:        127.0.0.1
Server Port:            8000

Document Path:          /
Document Length:        4576 bytes

Concurrency Level:      10
Time taken for tests:   381.589 seconds
Complete requests:      1000
Failed requests:        0
Total transferred:      4708000 bytes
HTML transferred:       4576000 bytes
Requests per second:    2.62 [#/sec] (mean)
Time per request:       3815.895 [ms] (mean)
Time per request:       381.589 [ms] (mean, across all concurrent requests)
Transfer rate:          12.05 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.0      0       0
Processing:   370 3797 951.8   3709    7305
Waiting:      370 3255 933.1   3322    6555
Total:        370 3797 951.8   3709    7305

Percentage of the requests served within a certain time (ms)
  50%   3709
  66%   4017
  75%   4319
  80%   4547
  90%   5000
  95%   5488
  98%   6095
  99%   6274
 100%   7305 (longest request)
```

Conclusion: pretty okay. Let's try some queries n stuff.

## Experiment Three

Going to try some concurrent queries now. Let's see what happens!

```
$ ab -s 300 -n 500 -c 10 http://127.0.0.1:8001/education/upload_school_tests
This is ApacheBench, Version 2.3 <$Revision: 1879490 $>
Copyright 1996 Adam Twiss, Zeus Technology Ltd, http://www.zeustech.net/
Licensed to The Apache Software Foundation, http://www.apache.org/

Benchmarking 127.0.0.1 (be patient)
Completed 100 requests
Completed 200 requests
Completed 300 requests
Completed 400 requests
Completed 500 requests
Finished 500 requests


Server Software:        uvicorn
Server Hostname:        127.0.0.1
Server Port:            8001

Document Path:          /education/upload_school_tests
Document Length:        144065 bytes

Concurrency Level:      10
Time taken for tests:   481.923 seconds
Complete requests:      500
Failed requests:        499
   (Connect: 0, Receive: 0, Length: 499, Exceptions: 0)
Total transferred:      71981921 bytes
HTML transferred:       71887921 bytes
Requests per second:    1.04 [#/sec] (mean)
Time per request:       9638.461 [ms] (mean)
Time per request:       963.846 [ms] (mean, across all concurrent requests)
Transfer rate:          145.86 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.1      0       0
Processing:   926 9554 841.3   9516   12307
Waiting:      924 9445 841.7   9452   11808
Total:        926 9554 841.2   9516   12307

Percentage of the requests served within a certain time (ms)
  50%   9516
  66%   9859
  75%  10000
  80%  10066
  90%  10410
  95%  10710
  98%  11070
  99%  11457
 100%  12307 (longest request)
```

## Experiment Four

The bottleneck seems to be table/template rendering. Let's try with 25 default max recs per page.

```
$ ab -s 300 -n 500 -c 10 http://127.0.0.1:8001/education/upload_school_tests
This is ApacheBench, Version 2.3 <$Revision: 1879490 $>
Copyright 1996 Adam Twiss, Zeus Technology Ltd, http://www.zeustech.net/
Licensed to The Apache Software Foundation, http://www.apache.org/

Benchmarking 127.0.0.1 (be patient)
Completed 100 requests
Completed 200 requests
Completed 300 requests
Completed 400 requests
Completed 500 requests
Finished 500 requests


Server Software:        uvicorn
Server Hostname:        127.0.0.1
Server Port:            8001

Document Path:          /education/upload_school_tests
Document Length:        50550 bytes

Concurrency Level:      10
Time taken for tests:   149.277 seconds
Complete requests:      500
Failed requests:        495
   (Connect: 0, Receive: 0, Length: 495, Exceptions: 0)
Total transferred:      25277719 bytes
HTML transferred:       25183719 bytes
Requests per second:    3.35 [#/sec] (mean)
Time per request:       2985.531 [ms] (mean)
Time per request:       298.553 [ms] (mean, across all concurrent requests)
Transfer rate:          165.37 [Kbytes/sec] received

Connection Times (ms)
              min  mean[+/-sd] median   max
Connect:        0    0   0.1      0       0
Processing:  1358 2945 295.0   2894    4326
Waiting:     1358 2940 293.7   2889    4307
Total:       1358 2945 295.0   2894    4327

Percentage of the requests served within a certain time (ms)
  50%   2894
  66%   2976
  75%   3032
  80%   3097
  90%   3273
  95%   3435
  98%   3772
  99%   3963
 100%   4327 (longest request)
```

That worked well! Removed most of the variance and kept response times reasonable under concurrent loads.

In further experiments, I found:

- Faceting is really efficient. Faceting on the huge education DB (`http://127.0.0.1:8001/education/upload_school_tests?_facet=subject&subject=Math`) had a max concurrent request time of `100%   2704 (longest request)`.
- The home page is slow, but not extremely slow; longest request: 7478ms. Table counts are one of the main reasons.
- Datasette is a single-process application, but it uses threads effectively. So we can scale horizontally via core-threads on a single machine.
- Properly tuning DBs is key here! If a specific DB turns out to be slow, it needs to be re-imported with properly indexed columns, or indexes need to be added manually (via [datasette-write](github.com/simonw/datasette-write))

## On Threading

It looks like asgi uses threads to do things in the background. I didn't set any threading counts or anything and this is what I got from one (very long lived) Datasette run:

        ## Thread stats
        name           id     tid              ttot      scnt
        _MainThread    0      4585467392       501247.3  7579
        Thread         1      123145324875776  5.630908  697
        Thread         3      123145358454784  2.525459  4145
        Thread         4      123145375244288  2.341908  713
        Thread         2      123145341665280  1.684009  5339
        Thread         5      123145392033792  0.011702  9

