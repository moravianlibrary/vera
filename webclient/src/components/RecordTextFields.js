import React, { Component, useState } from 'react';
import TextField from '@material-ui/core/TextField';
import i18n from 'i18next';

import { Record } from '../models/Record';
import { withTranslation } from 'react-i18next';
  

class RecordTextFields extends Component {
  constructor(props) {
    super(props);
    this.record = new Record();
  }

  getRecord() {
    return this.record;
  }

  fromJson(jsonData) {
    this.record.fromJson(jsonData);
  }

  render() {
    const { t } = this.props;

    return (
      <div>
        {/* <TextField
        autoFocus
        margin="dense"
        id="sysno"
        label={t("sysno")}
        type="text"
        fullWidth
        variant="standard"
        value={this.record.sysno}
        onChange={(e) => this.record.setSysno(e.target.value)}
        /> */}
        {/* <TextField
        margin="dense"
        id="volume_number"
        label={i18n("volume_number")}
        type="text"
        fullWidth
        variant="standard"
        value={this.record.volume_number}
        onChange={(e) => this.record.setVolumeNumber(e.target.value)}
        />
        <TextField
        margin="dense"
        id="item_number"
        label={i18n("item_number")}
        type="text"
        fullWidth
        variant="standard"
        value={this.record.item_number}
        onChange={(e) => this.record.setItemNumber(e.target.value)}
        />
        <TextField
        margin="dense"
        id="category"
        label={i18n("category")}
        type="text"
        fullWidth
        variant="standard"
        value={this.record.category}
        onChange={(e) => this.record.setCategory(e.target.value)}
        />
        <TextField
        margin="dense"
        id="title"
        label={i18n("title")}
        type="text"
        fullWidth
        variant="standard"
        value={this.record.title}
        onChange={(e) => this.record.setTitle(e.target.value)}
        />
        <TextField
        margin="dense"
        id="pages_count"
        label={i18n("pages_count")}
        type="text"
        fullWidth
        variant="standard"
        inputProps={{
            inputMode: 'numeric',
            pattern: '[0-9]*', // Allow only numbers (0-9)
        }}
        value={this.record.pages_count}
        onChange={(e) => this.record.setPagesCouni18n(e.target.value)}
        />
        <TextField
        margin="dense"
        id="signature"
        label={i18n("signature")}
        type="text"
        fullWidth
        variant="standard"
        value={this.record.signature}
        onChange={(e) => this.record.setSignature(e.target.value)}
        />
        <TextField
        margin="dense"
        id="issn"
        label={i18n("issn")}
        type="text"
        fullWidth
        variant="standard"
        value={this.record.issn}
        onChange={(e) => this.record.setIssn(e.target.value)}
        />
        <TextField
        margin="dense"
        id="isbn"
        label={i18n("isbn")}
        type="text"
        fullWidth
        variant="standard"
        value={this.record.isbn}
        onChange={(e) => this.record.setIsbn(e.target.value)}
        />
        <TextField
        margin="dense"
        id="barcode"
        label={i18n("barcode")}
        type="text"
        fullWidth
        variant="standard"
        value={this.record.barcode}
        onChange={(e) => this.record.setBarcode(e.target.value)}
        /> */}
      </div>
    );
  }
}

export default withTranslation()(RecordTextFields);
