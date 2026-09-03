'use strict';

const { desktopCapturer } = require('electron');

/**
 * Wires the display-media request handler so the renderer's getDisplayMedia()
 * call resolves with the Windows WASAPI loopback stream (i.e. whatever the
 * machine is currently playing) instead of a microphone.
 *
 * Electron requires a video source alongside `audio: 'loopback'`; the renderer
 * discards that video track immediately after acquiring the stream.
 *
 * @param {Electron.Session} session Session to attach the handler to.
 */
function enableSystemAudioLoopback(session) {
  session.setDisplayMediaRequestHandler(
    (request, callback) => {
      desktopCapturer
        .getSources({ types: ['screen'], thumbnailSize: { width: 0, height: 0 } })
        .then((sources) => {
          if (!sources.length) {
            // No screen to pair with: deny rather than hand back a half stream.
            callback({});
            return;
          }
          callback({ video: sources[0], audio: 'loopback' });
        })
        .catch(() => callback({}));
    },
    // The OS picker would force the user to choose a window every launch.
    { useSystemPicker: false }
  );
}

module.exports = { enableSystemAudioLoopback };
