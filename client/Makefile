.PHONY: all clean

SRC=./src/app.ts \
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

all: ./build/app.js ./build/index.html node_modules
	install src/deps/*.js build/js/
	rsync -ra --delete style/ build/style
	cp index.html build/

./build/app.js: $(SRC)
	./node_modules/.bin/tsc --noImplicitAny --target es6 --outDir ./.obj $^
	./node_modules/.bin/browserify -o $@ -e ./.obj/app.js -t [ babelify ]

./build/index.html: index.html
	cp $^ $@

node_modules: package.json
	npm update
	touch node_modules

clean:
	rm -r .obj/*
	rm -r build/*
