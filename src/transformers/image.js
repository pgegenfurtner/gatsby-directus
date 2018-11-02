import fs from 'fs-extra';
import request from 'request';
import Colors from 'colors';
import path from 'path';
import { programDirectory, siteUrl, buildEntry, digest, createNodeId } from '../transform';

const fileTypeToLowerCase = (filename) => {
  const fileType = filename.replace(/.*\./, '');
  return filename.replace(/\..*?$/, `.${fileType.toLowerCase()}`);
};

/**
 * Downloads file from directus server to file system
 * 
 * @param {*} url 
 * @param {*} localFile 
 */
const downloadAndMoveToCache = async (url, localFile) => {
    fs.ensureFileSync(localFile);
    const fileContents = fs.readFileSync(localFile, 'utf8');
    if (fileContents) {
        return true;
    } else {
        console.log(`Syncing Image from Directus: ${url}`.cyan);
        let returnVal = false;
        await new Promise((resolve, reject) => {
            request.head(url, (error, response, body) => {
                request(url).pipe(fs.createWriteStream(localFile)).on('close', () => {
                    console.log(`Image successfully downloaded, Local Path: ${localFile}`.cyan)
                    returnVal = true;
                    resolve('success');
                }).on('error', reject);
            });
        });
        return returnVal;
    }
};

let fileCopied = false;
const copyDefaultFile = (newPath) => {
    if (!fileCopied) {
        fs.copySync(path.resolve(__dirname, '../image/default.png'), newPath);
        fileCopied = true;
    }

    return true;
};

let gatsbyImageDoesNotExist = true;
try {
    require.resolve(`gatsby-image`);
    require.resolve(`gatsby-plugin-sharp`);
    require.resolve(`gatsby-transformer-sharp`);
    gatsbyImageDoesNotExist = false;
} catch (exception) {}

export default {
    test: (columnData) => {
        return columnData.ui === 'single_file' && columnData.related_table === 'directus_files';
    },

    transform: async ({
        tableName,
        entryId,
        entryType,
        columnData,
        value,
        entry,
        foreignTableReference,
        directusEntry
    }) => {
        let localImagePath, imageUrlOnServer, fileName, fileType, mimeType, fileTitle, fileCaption;
        if (!value) {
            localImagePath = `${programDirectory}/.cache/directus/__default.png`;
            imageUrlOnServer = localImagePath;
            copyDefaultFile(localImagePath);
            fileName = '__default.png';
            fileType = 'png';
            mimeType = `image/${fileType}`;
        } else {
            imageUrlOnServer = `${siteUrl}${value.data.url}`;
            localImagePath = `${programDirectory}/.cache/directus${fileTypeToLowerCase(value.data.url)}`;
            await downloadAndMoveToCache(imageUrlOnServer, localImagePath);
            /** TODO: Better way to get name and mimetype for the file */
            fileName = value.data.name.replace(/\..*?$/, '');
            fileType = value.data.name.replace(/.*\./, '').toLowerCase();
            fileTitle = value.data.title;
            fileCaption = value.data.caption;
            mimeType = `image/${fileType}`;
        }

        const node = {
            id: createNodeId(entryId, columnData.id),
            parent: directusEntry.id,
            children: [],
            absolutePath: localImagePath,
            extension: fileType,
            name: fileName,
            title: fileTitle,
            caption: fileCaption,
            internal: {
                type: createNodeId(tableName, columnData.id),
                mediaType: mimeType,
                content: imageUrlOnServer,
                contentDigest: digest(localImagePath)
            }
        };

        return {
            node,
            type: 'complex',
            value: value
        };
    }
};