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
	mkdir -p build/{style/fonts,js} 2>/dev/null || true

.obj:
	mkdir -p .obj 2>/dev/null || true

./build/js/app.js: node_modules build .obj $(SRC)
	./node_modules/.bin/tsc --noImplicitAny --target es6 --outDir ./.obj $(SRC)
	./node_modules/.bin/browserify -o $@ -e ./.obj/app.js -t [ babelify --blacklist regenerator ]

./build/js/worker-search.js: node_modules build .obj $(WORKER_DATABASE)
	./node_modules/.bin/browserify -o $@ -e $(WORKER_DATABASE) -t [ babelify --blacklist regenerator ]

./build/index.html: index.html ./build/style/main.css ./build/style/normalize.css
	cp index.html $@

./build/style/main.css: build ./style/*.hcss ./style/*.css
	mkdir ./build/style 2>/dev/null || true
	hasp ./style/main.hcss > $@

./build/style/%.css: ./style/%.css
	cp $^ $@

lint:
	./node_modules/.bin/tslint $(SRC)
	./node_modules/.bin/jshint -c .jshintrc $(WORKER_DATABASE)

node_modules: package.json
	npm update
	touch node_modules

clean:
	rm -r .obj
	rm -r build
