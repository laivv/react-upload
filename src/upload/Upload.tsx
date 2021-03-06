import * as React from 'react';
import * as PropTypes from 'prop-types';
import './Upload.css';
import './font/iconfont.css';
import UploadFileList from './UploadFileList';
import Uploader from './uploader';
import Previewer from '../previewer/Previewer';

interface Props {
  url: string,
  fileList: any[],
  multiple: boolean,
  previewMode: boolean,
  showFileName: boolean,
  tokenUrl: string[],
  onChange: any,
  maxFileCount: number,
  maxFileSize: number,
  acceptList: string[],
  beforeFileAdd: any,
  onCountError: any,
  onTypeError: any,
  onSizeError: any,
  onFileSuccess: any,
  onFileError: any,
  onUploadComplete: any
}

export default class Upload extends React.Component {
  inputRef:any;
   props : Props;
   state : {

      isQiniu: boolean,
      tokens: any,
      fileList: any[],
      supportView: boolean,
      isOverMaxCount:boolean,
      token?:string
   }
   $previewer:any

  static defaultProps :any = {
    url: 'http://up.qiniu.com',
    fileList: [],
    previewMode: false,
    multiple: true,
    showFileName: false,
    acceptList: [],
    tokenUrl: [],
  };
  static propTypes = {
    url: PropTypes.string.isRequired,
    fileList: PropTypes.array,
    multiple: PropTypes.bool,
    previewMode: PropTypes.bool,
    showFileName: PropTypes.bool,
    tokenUrl: PropTypes.array,
    onChange: PropTypes.func,
    maxFileCount: PropTypes.number,
    maxFileSize: PropTypes.number,
    acceptList: PropTypes.array,
    beforeFileAdd: PropTypes.func,
    onCountError: PropTypes.func,
    onTypeError: PropTypes.func,
    onSizeError: PropTypes.func,
    onFileSuccess: PropTypes.func,
    onFileError: PropTypes.func,
    onUploadComplete: PropTypes.func
  };
  constructor(props:any) {
    super(props);
    this.inputRef = React.createRef();
    this.state = {
      isQiniu: /\.qiniu\./gi.test(this.props.url),
      tokens: {},
      fileList: props.fileList,
      supportView: !!FileReader,
      isOverMaxCount: props.maxFileCount !== undefined && props.fileList.length >= props.maxFileCount,
    };
  }

  createId = (function () {
    let id = 0;
    return () => `${Date.now()}${++id}`;
  })();
  getExt(file:any) {
    const ret = file.name.match(/\.(\w+)$/);
    return ret ? ret[1] : '';
  }
  openFileBrowser() {
    this.inputRef.current.click();
  }
  copyFileList() {
    return [...this.state.fileList].map(file => {
      return { ...file };
    });
  }
  getFileByFile(fileList:any[], file:any) {
    return fileList.filter(rawFile => rawFile.id === file.id)[0] || null;
  }
  updateFile(file:any, options:any):any {
    let fileList = this.copyFileList();
    file = this.getFileByFile(fileList, file);
    if (file) {
      for (let attr in options) {
        file[attr] = options[attr];
      }
      return this.updateFileList(fileList);
    }
    return Promise.resolve();
  }
  getUploadStatus() {
    const pendings :any = ['waiting', 'pending'];
    for (let [index, file] of this.state.fileList.entries()) {
      if (pendings.includes(file.status)) {
        return false
      }
    }
    return true
  }
  updateFileList(fileList:any[]) {
    return new Promise((resolve:any, reject:any) => {
      this.setState({ fileList }, () => {
        resolve();
        this.props.onChange && this.props.onChange(fileList);
      });
    });
  }
  isImage(file:any) {
    return ['jpg', 'png', 'gif', 'bmp', 'webp', 'jpeg'].includes(file.ext);
  }
  handleStart(file:any) {
    if (this.state.supportView && this.isImage(file)) {
      const reader = new FileReader();
      reader.readAsDataURL(file.rawFile);
      reader.onload = () => {
        this.updateFile(file, { src: reader.result });
      };
    }
  }
  isError(file:any, fileList:any[]) {
    return this.isCountError(fileList) || this.isTypeError(file) || this.isSizeError(file);
  }
  isTypeError(file:any) {
    if (this.props.acceptList.length && !this.props.acceptList.includes(file.ext)) {
      return true;
    }
    return false;
  }
  isSizeError(file:any) {
    if (this.props.maxFileSize !== undefined && file.size > this.props.maxFileSize) {
      return true;
    }
    return false;
  }
  isCountError(fileList:any[]) {
    if (this.props.maxFileCount !== undefined && fileList.length >= this.props.maxFileCount) {
      return true;
    }
    return false;
  }
  createGuid(len:number, radix:number) {
    let chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
    let uuid = [],
      i;
    radix = radix || chars.length;
    if (len) {
      for (i = 0; i < len; i++) uuid[i] = chars[0 | (Math.random() * radix)];
    } else {
      let r;
      uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
      uuid[14] = '4';
      for (i = 0; i < 36; i++) {
        if (!uuid[i]) {
          r = 0 | (Math.random() * 16);
          uuid[i] = chars[i == 19 ? (r & 0x3) | 0x8 : r];
        }
      }
    }
    return uuid.join('');
  }
  getKey(file:any) {
    let ext = file.ext ? '.' + file.ext : '';
    let key = (this.state.tokens.prefix ? this.state.tokens.prefix : 'A') + '.' + this.createGuid(8, 16) + ext;
    return key;
  }
  getFileType(ext:string) {
    if (['jpg', 'png', 'gif', 'bmp', 'jpeg', 'webp'].indexOf(ext) > -1) {
      return 'image';
    }
    if (['mp4', 'avi', 'rmvb', 'mkv', '3gp'].indexOf(ext) > -1) {
      return 'video';
    }
    if (['rar', 'zip', '7z', 'cab'].indexOf(ext) > -1) {
      return 'rar';
    }
    if (ext === 'txt') {
      return 'text';
    }
    if (['mp3', 'ogg', 'm4a', 'wav', 'ape', 'flac', 'wma', 'aac', 'amr'].indexOf(ext) > -1) {
      return 'audio';
    }
    return 'file';
  }
  reload(file:any) {
    this.updateFile(file, { status: 'waiting', progress: 0 })
      .then(() => {
        this.upload(file);
      })
  }
  upload(file:any) {
    let options :any= { file };
    if (this.state.isQiniu) {
      options.key = this.getKey(file);
      options.token = this.state.token;
    } else {
      Object.assign(options, this.state.tokens);
    }
    new Uploader(this.props.url)
      .upload(options)
      .setDataType('json')
      .start(file => {
        //file.status = 'pending';
        this.updateFile(file, { status: 'pending' });
      })
      .progress((file, progress) => {
        //file.progress = progress;
        this.updateFile(file, { progress });
      })
      .then((file, response:any) => {
        let src = undefined;
        if (this.props.onFileSuccess) {
          let params = Object.keys(this.state.tokens).length ? this.state.tokens : undefined;
          src = this.props.onFileSuccess(file, response, params);
          if (file.src) {
            src = file.src;
          }
          src =
            src === undefined
              ? this.state.isQiniu
                ? this.state.tokens.domain + response.key
                : response
              : src;
        }
        this.updateFile(file, { src, status: 'success' })
          .then(() => {
            if (this.props.onUploadComplete && this.getUploadStatus()) {
              this.props.onUploadComplete();
            }
          })
      })
      .catch(file => {
        //file.status = 'error';
        this.updateFile(file, { status: 'error' })
          .then(() => {
            this.props.onFileError && this.props.onFileError(file);
            if (this.props.onUploadComplete && this.getUploadStatus()) {
              this.props.onUploadComplete();
            }
          })
      });
  }
  handleLengthChange(fileList:any[]) {
    const isOverMaxCount = this.props.maxFileCount !== undefined && fileList.length >= this.props.maxFileCount;
    if (this.state.isOverMaxCount !== isOverMaxCount) {
      this.setState({ isOverMaxCount });
    }
  }
  handleFileChange() {
    if (this.inputRef.current.value === '') {
      return;
    }
    let fileList = this.copyFileList();
    const { length } = fileList;
    let addFileList = Array.from(this.inputRef.current.files).map((rawFile:File) => {
      let ext = this.getExt(rawFile);
      return {
        id: this.createId(),
        name: rawFile.name,
        ext,
        size: rawFile.size / 1024 / 1024,
        type: this.getFileType(ext),
        rawFile: rawFile,
        status: 'pending',
        progress: 0,
        src: '',
      };
    });
    this.inputRef.current.value = '';
    let countErrorFiles = [],
      typeErrorFiles = [],
      sizeErrorFiles = [];
    for (let i = 0, len = addFileList.length; i < len; i++) {
      let file = addFileList[i];
      if (!this.isError(file, fileList)) {
        let next = true;
        if (this.props.beforeFileAdd) {
          next = this.props.beforeFileAdd(file);
          next = next === undefined ? true : next;
        }
        if (next) {
          fileList.push(file);
          this.handleStart(file);
          this.upload(file);
        }
      } else {
        if (this.isCountError(fileList)) {
          countErrorFiles.push(file);
        } else if (this.isTypeError(file)) {
          typeErrorFiles.push(file);
        } else if (this.isSizeError(file)) {
          sizeErrorFiles.push(file);
        }
      }
    }
    if (length !== fileList.length) {
      this.updateFileList(fileList);
      this.handleLengthChange(fileList);
    }
    this.props.onCountError && countErrorFiles.length && this.props.onCountError(countErrorFiles);
    this.props.onTypeError && typeErrorFiles.length && this.props.onTypeError(typeErrorFiles);
    this.props.onSizeError && sizeErrorFiles.length && this.props.onSizeError(sizeErrorFiles);
  }
  getFileIndex(fileList:any[], file:any) {
    for (let i = 0, len = fileList.length; i < len; i++) {
      let item = fileList[i];
      if (item.id === file.id) {
        return i;
      }
    }
    return -1;
  }
  removeFile(fileList:any[], file:any) {
    let index = this.getFileIndex(fileList, file);
    if (index !== -1) {
      fileList.splice(index, 1);
    }
    return fileList;
  }
  handleFileRemove(file:any) {
    const oldStatus = this.getUploadStatus();
    let fileList = this.copyFileList();
    this.removeFile(fileList, file);
    this.updateFileList(fileList)
      .then(() => {
        this.handleLengthChange(fileList);
        if (this.props.onUploadComplete && !oldStatus && this.getUploadStatus()) {
          this.props.onUploadComplete();
        }

      })
  }
  render() {
    let isMutiple = this.props.multiple;
    let fileList = this.state.fileList;
    return (
      <div>
        {isMutiple ? (
          <input
            type="file"
            className="uk-upload-hidden"
            multiple={true}
            ref={this.inputRef}
            onChange={() => {
              this.handleFileChange();
            }}
          />
        ) : (
            <input
              type="file"
              className="uk-upload-hidden"
              ref={this.inputRef}
              onChange={() => {
                this.handleFileChange();
              }}
            />
          )}

        <UploadFileList
          fileList={fileList}
          onItemClick={file => {
            const index = this.state.fileList.indexOf(file);
            this.$previewer.open(index);
          }}
          onItemRemove={file => {
            this.handleFileRemove(file);
          }}
          readonly={this.props.previewMode}
          showFileName={this.props.showFileName}
          onAddClick={() => this.openFileBrowser()}
          onRetryClick={file => this.reload(file)}
          allowUpload={!this.state.isOverMaxCount}
        />
        <Previewer
          fileList={fileList}
          ref={ref => this.$previewer = ref}
        ></Previewer>
      </div>
    );
  }
}
