import * as async from 'async';
import * as chokidar from 'chokidar';
import * as fs from 'fs-extra';
import Mock from './mock';
import Configuration from './configuration';
import Processor from './processor';

import 'rxjs/add/operator/last';

(module).exports = function () {
    'use strict';

    const processor = new Processor();
    const defaults = {
        destination: '.tmp/mocks/'
    };
    const utils = require('../lib/utils.js');

    return {
        run: run,
        watch: watch
    };

    /**
     * Run ngapimock.
     * @param configuration The configuration.
     */
    function run(configuration: Configuration) {
        return new Promise((resolve, reject) => {
            if (configuration === undefined) {
                console.error('No configuration has been specified.');
            }

            if (configuration.src === undefined) {
                console.error('No mock source directory have been specified.');
            }

            const config = {
                source: configuration.src,
                done: configuration.done !== undefined ? configuration.done : () => {
                },
                destination: configuration.outputDir !== undefined ? configuration.outputDir : defaults.destination
            };

            let mocks: Mock[];

            async.series({
                    processMocks: (callback: Function) => {
                        console.info('Process all the mocks');
                        processor.processMocks(config.source).last().subscribe((_) => {
                            mocks = _;
                            callback(null, 'processed mocks');
                        });
                    },
                    registerMocks: function (callback) {
                        console.info('Register mocks');
                        utils.registerMocks(mocks).then(() => {
                            callback(null, 'registered mocks');
                        });
                    },
                    generateMockingInterface: function (callback) {
                        console.info('Generate the mocking web interface');
                        processor.generateMockingInterface(config.destination);
                        callback(null, 'generated mocking interface');
                    },
                    generateProtractorMock: function (callback) {
                        console.info('Generate protractor.mock.js');
                        processor.generateProtractorMock(config.destination);
                        callback(null, 200);
                    }
                },
                function (err) {
                    if (err !== undefined && err !== null) {
                        console.error(err);
                    }
                    config.done();
                    resolve();
                });
        });
    }

    /**
     * Watch to file changes.
     * @param directory The directory to watch
     */
    function watch(directory: String) {
        console.info('Watching', directory, 'for changes');
        const watcher = chokidar.watch(directory + '/**/*.mock.json', {
            ignored: /[\/\\]\./,
            persistent: true
        });
        watcher
            .on('add', path => _processMock(path))
            .on('change', path => _processMock(path))
            .on('unlink', path => _processMock(path));
    }

    /**
     * Processes all the mocks that are present in the given directory.
     * @param {string} directory The directory containing the mocks.
     * @returns {Mock[]} mocks The mocks.
     */
    function _processMock(file: string): void {
        processor.processMock(file).then((mock) => {
            utils.updateMock(mock);
        }, () => {
            console.info(file, 'contains invalid json');
        });
    }
};
