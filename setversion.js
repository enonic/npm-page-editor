#!/usr/bin/env node

"use strict";

const {execSync} = require("child_process");
const fs = require("fs");

const version = execSync("git describe --tags --abbrev=0").toString().slice(1).trim();
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
pkg.version = version;
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
