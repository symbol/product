const fs = require('fs');
const path = require('path');
require('dotenv').config();

const copyFileSync = (source, target) => {
	let targetFile = target;

	if (fs.existsSync(target) && fs.lstatSync(target).isDirectory())
		targetFile = path.join(target, path.basename(source));

	fs.writeFileSync(targetFile, fs.readFileSync(source));
};

const copyFolderRecursiveSync = (source, target) => {
	const targetFolder = path.join(target, path.basename(source));
	if (!fs.existsSync(targetFolder))
		fs.mkdirSync(targetFolder);

	if (!fs.lstatSync(source).isDirectory())
		return;

	const files = fs.readdirSync(source);
	files.forEach(file => {
		const curSource = path.join(source, file);
		if (fs.lstatSync(curSource).isDirectory())
			copyFolderRecursiveSync(curSource, targetFolder);
		else
			copyFileSync(curSource, targetFolder);
	});
};

const destination = __dirname + '/../';

switch (process.env.REACT_APP_BUILD_TARGET) {
case 'nem': {
	const source = __dirname + '/../src/nem/public';
	copyFolderRecursiveSync(source, destination);
	break;
}
case 'symbol': {
	const source = __dirname + '/../src/symbol/public';
	copyFolderRecursiveSync(source, destination);
	break;
}
default:
	throw Error('The build target is not specified');
}
