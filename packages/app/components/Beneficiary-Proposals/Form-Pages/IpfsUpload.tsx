import React, { useState, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';

import { CheckIcon, DocumentAddIcon, XIcon } from '@heroicons/react/solid';
import toast, { Toaster } from 'react-hot-toast';

const baseStyle = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '20px',
  borderWidth: 2,
  borderRadius: 2,
  borderColor: '#eeeeee',
  borderStyle: 'dashed',
  backgroundColor: '#fafafa',
  color: '#bdbdbd',
  outline: 'none',
  transition: 'border .24s ease-in-out',
};

const activeStyle = {
  borderColor: '#2196f3',
};

const acceptStyle = {
  borderColor: '#00e676',
};

const rejectStyle = {
  borderColor: '#ff1744',
};

const FIVE_MB = 3 * 1000 * 1024;

function imageSizeValidator(file) {
  if (file.size > FIVE_MB) {
    uploadError('File size is greater than 5mb limit');
    return {
      code: 'file-too-large',
      message: `Size is larger than ${FIVE_MB} bytes`,
    };
  }
  return null;
}

const success = () => toast.success('Successful upload to IPFS');
const loading = () => toast.loading('Uploading to IPFS...');
const uploadError = (errMsg: string) => toast.error(errMsg);

export const uploadImageToPinata = (files, setProfileImage) => {
  var myHeaders = new Headers();
  myHeaders.append('pinata_api_key', process.env.PINATA_API_KEY);
  myHeaders.append('pinata_secret_api_key', process.env.PINATA_API_SECRET);

  var formdata = new FormData();
  formdata.append('file', files[0], 'download.png');

  loading();
  fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
    method: 'POST',
    headers: myHeaders,
    body: formdata,
    redirect: 'follow',
  })
    .then((response) => response.text())
    .then((result) => {
      const hash = JSON.parse(result).IpfsHash;
      setProfileImage(hash);
      toast.dismiss();
      success();
    })
    .catch((error) => {
      uploadError('Error uploading to IPFS');
      console.log('error', error);
    });
};

export default function IpfsUpload({
  currentStep,
  setCurrentStep,
  localStorageFile,
  setLocalStorage,
  imageDescription,
  imageInstructions,
  fileType,
  numMaxFiles
}) {
  const [files, setFiles] = useState([]);

  const {
    acceptedFiles,
    fileRejections,
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    accept: fileType,
    maxFiles: numMaxFiles,
    validator: imageSizeValidator,
    onDrop: (acceptedFiles) => {
      uploadImageToPinata(acceptedFiles, setLocalStorage);
      setFiles(
        acceptedFiles.map((file) =>
          Object.assign(file, {
            preview: URL.createObjectURL(file),
          }),
        ),
      );
    },
  });

  const style = useMemo(
    () => ({
      ...baseStyle,
      ...(isDragActive ? activeStyle : {}),
      ...(isDragAccept ? acceptStyle : {}),
      ...(isDragReject ? rejectStyle : {}),
    }),
    [isDragActive, isDragReject, isDragAccept],
  );

  return (
    <div className="mx-auto content-center grid justify-items-stretch">
      <h2 className="justify-self-center text-base text-indigo-600 font-semibold tracking-wide uppercase">
        5 - Upload Profile Image
      </h2>
      {!localStorageFile ? (
        <div {...getRootProps({ style })}>
          <input {...getInputProps()} />
          <p className="mt-4 max-w-3xl mx-auto text-center text-xl text-gray-500">
            Drag 'n' drop, or click here to upload a {imageDescription}
          </p>
          <p className="my-4 max-w-3xl mx-auto text-center text-l text-gray-500">
            {imageInstructions}
          </p>
          <DocumentAddIcon className="h-10 w-10" />
        </div>
      ) : (
        <div></div>
      )}
      {localStorageFile ? (
        <div className="grid justify-items-stretch">
          <p className="my-4 max-w-3xl mx-auto text-center text-xl text-gray-500 w-1/3 justify-self-center">
            Image Preview
          </p>
          <img
            className="w-1/4 justify-self-center"
            src={'https://gateway.pinata.cloud/ipfs/' + localStorageFile}
          ></img>
          <div className="row-auto my-2 justify-self-center">
            <button
              onClick={() => setLocalStorage(null)}
              className="mx-2 justify-self-center mt-4 inline-flex px-4 py-2 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Cancel
              <XIcon className="ml-2 -mr-1 h-5 w-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => setCurrentStep(currentStep++)}
              className="mx-2 justify-self-center mt-4 inline-flex px-4 py-2 border border-transparent text-sm font-medium rounded-md text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              OK
              <CheckIcon className="ml-2 -mr-1 h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <> </>
      )}
      <Toaster />
    </div>
  );
}
