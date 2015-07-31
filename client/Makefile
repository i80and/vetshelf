TRANSFORM_BLACKLIST=es6.forOf,regenerator

.PHONY: all check clean

all: build/js/app.min.js
	install src/deps/*.js build/js/
	rsync -ra --delete style/ build/style
	cp index.html build/

build/js/%.min.js: build/js/%.js
	cp $^ $@

build/js/app.js: src/*.js
	mkdir -p build/js
	./node_modules/.bin/jshint --verbose src/*.js &
	./node_modules/.bin/browserify -d -o $@ -e src/app.js -t [ babelify --blacklist $(TRANSFORM_BLACKLIST) --optional es7.asyncFunctions --sourceMapRelative . ]

node_modules: package.json
	npm update

check: node_modules
	./node_modules/.bin/jshint --verbose src/*.js

clean:
	$(RM) -r build/*
