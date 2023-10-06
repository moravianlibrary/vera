import React, { Component, useState } from 'react';
import TextField from '@material-ui/core/TextField';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import i18n from 'i18next';

const containerStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  border: '1px solid #ccc',
  padding: '20px',
  borderRadius: '8px',
  margin: '10px',
};
const containerHeaderStyle = {
  'margin-bottom': '15px'
};

class RecordTextFields extends Component {
  constructor(props) {
    super(props);
    this.state = {
      record: props.record,
    };
  }

  render() {
    const { record } = this.state;

    return (
      <div>
        <Paper elevation={3} style={containerStyle}>
          <Typography variant="h6" style={containerHeaderStyle}>
            {i18n.t("record_title")}
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            id="sysno"
            label={i18n.t("sysno")}
            type="text"
            fullWidth
            variant="standard"
            value={record.sysno}
            onChange={(e) => this.setState({ record: { ...record, sysno: e.target.value } })}
          /> 
          <TextField
            margin="dense"
            id="volume_number"
            label={i18n.t("volume_number")}
            type="text"
            fullWidth
            variant="standard"
            value={record.volume_number}
            onChange={(e) => this.setState({ record: { ...record, volume_number: e.target.value } })}
          />
          <TextField
            margin="dense"
            id="item_number"
            label={i18n.t("item_number")}
            type="text"
            fullWidth
            variant="standard"
            value={record.item_number}
            onChange={(e) => this.setState({ record: { ...record, item_number: e.target.value } })}
          />
          <TextField
            margin="dense"
            id="category"
            label={i18n.t("category")}
            type="text"
            fullWidth
            variant="standard"
            value={record.category}
            onChange={(e) => this.setState({ record: { ...record, category: e.target.value } })}

          />
          <TextField
            margin="dense"
            id="title"
            label={i18n.t("title")}
            type="text"
            fullWidth
            variant="standard"
            value={record.title}
            onChange={(e) => this.setState({ record: { ...record, title: e.target.value } })}
          />
          <TextField
            margin="dense"
            id="pages_count"
            label={i18n.t("pages_count")}
            type="text"
            fullWidth
            variant="standard"
            inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*',
            }}
            value={record.pages_count}
            onChange={(e) => this.setState({ record: { ...record, pages_count: e.target.value } })}
          />
          <TextField
            margin="dense"
            id="signature"
            label={i18n.t("signature")}
            type="text"
            fullWidth
            variant="standard"
            value={record.signature}
            onChange={(e) => this.setState({ record: { ...record, signature: e.target.value } })}
          />
          <TextField
            margin="dense"
            id="issn"
            label={i18n.t("issn")}
            type="text"
            fullWidth
            variant="standard"
            value={record.issn}
            onChange={(e) => this.setState({ record: { ...record, issn: e.target.value } })}
          />
          <TextField
            margin="dense"
            id="isbn"
            label={i18n.t("isbn")}
            type="text"
            fullWidth
            variant="standard"
            value={record.isbn}
            onChange={(e) => this.setState({ record: { ...record, isbn: e.target.value } })}
          />
          <TextField
            margin="dense"
            id="barcode"
            label={i18n.t("barcode")}
            type="text"
            fullWidth
            variant="standard"
            value={record.barcode}
            onChange={(e) => this.setState({ record: { ...record, barcode: e.target.value } })}
          />
        </Paper>
      </div>
    );
  }
}

export default RecordTextFields;
