.PHONY: all clean

SRC=./src/app.ts \
	./src/appointmentEditor.ts \
    ./src/calendarWidget.ts \
    ./src/Client.ts \
    ./src/Connection.ts \
    ./src/Login.ts \
    ./src/optionsWidget.ts \
    ./src/Patient.ts \
    ./src/Search.ts \
    ./src/SearchResults.ts \
    ./src/toggleWidget.ts \
    ./src/util.ts \
    ./src/Visit.ts

all: ./build/js/app.js ./build/index.html
	install src/deps/*.js build/js/
	rsync -ra style/fonts build/style/
	cp index.html build/

build:
	mkdir -p build/{style/fonts,js} 2>/dev/null || true

.obj:
	mkdir -p .obj 2>/dev/null || true

./build/js/app.js: node_modules build .obj $(SRC)
	./node_modules/.bin/tsc --noImplicitAny --target es6 --outDir ./.obj $(SRC)
	./node_modules/.bin/browserify -o $@ -e ./.obj/app.js -t [ babelify ]

./build/index.html: index.html ./build/style/main.css ./build/style/normalize.css
	cp index.html $@

./build/style/main.css: build ./style/*.hcss ./style/*.css
	mkdir ./build/style 2>/dev/null || true
	hasp ./style/main.hcss > $@

./build/style/%.css: ./style/%.css
	cp $^ $@

node_modules: package.json
	npm update
	touch node_modules

clean:
	rm -r .obj
	rm -r build
