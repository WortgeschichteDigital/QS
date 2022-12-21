"use strict";

const about = {
  // decodes a coded mail address
  //   coded = string (coded address)
  decodeMail (coded) {
    let decoded = "";
    for (let i = 0, len = coded.length; i < len; i++) {
      let charCode = coded.charCodeAt(i);
      if (i % 2 === 0) {
        charCode -= 2;
      } else {
        charCode--;
      }
      decoded += String.fromCharCode(charCode);
    }
    return decoded.split("trenner")[1];
  },
};
