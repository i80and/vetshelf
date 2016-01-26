.PHONY: all clean jshint

SRC=./src/app.ts \
	./src/appointmentEditor.ts \
    ./src/calendarWidget.ts \
    ./src/Client.ts \
    ./src/PhoneInfo.ts \
    ./src/Connection.ts \
    ./src/Login.ts \
    ./src/Import.ts \
    ./src/optionsWidget.ts \
    ./src/Patient.ts \
    ./src/Search.ts \
    ./src/Database.ts \
    ./src/SearchResults.ts \
    ./src/toggleWidget.ts \
    ./src/util.ts \
    ./src/Visit.ts

WORKER_DATABASE=./src/workers/database/main.js

all: ./build/js/app.js ./build/index.html ./build/js/worker-search.js
	install src/deps/*.js build/js/
	rsync -ra style/fonts build/style/
	cp index.html build/

build:
	mkdir -p build/style build/style/fonts build/js 2>/dev/null || true

./build/js/app.js: node_modules build $(SRC)
	./node_modules/.bin/tsc
	./node_modules/.bin/rollup -o $@ -i ./.obj/app.js

./build/js/worker-search.js: build $(WORKER_DATABASE)
	cp $(WORKER_DATABASE) $@

./build/index.html: index.html ./build/style/main.css ./build/style/normalize.css
	cp index.html $@

./build/style/main.css: build ./style/*.hcss ./style/*.css
	mkdir ./build/style 2>/dev/null || true
	hasp ./style/main.hcss > $@

./build/style/%.css: ./style/%.css
	cp $^ $@

lint:
	./node_modules/.bin/tsfmt -r
	./node_modules/.bin/tsfmt -r -- $(WORKER_DATABASE)
	./node_modules/.bin/tslint $(SRC)
	./node_modules/.bin/jshint -c .jshintrc $(WORKER_DATABASE)

node_modules: package.json
	npm update
	touch node_modules

clean:
	rm -rf .obj
	rm -rf build
