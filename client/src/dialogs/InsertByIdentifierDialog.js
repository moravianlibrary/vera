import React, { useState, useRef } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import { MenuItem } from '@material-ui/core';
import { Select } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';
import { useTranslation, withTranslation } from "react-i18next";

import { api } from '../services/Api';
import RecordTextFields from '../components/RecordTextFields';

const InsertByIdentifierDialog = () => {
  const insertDialogButtonStyle = {
    textTransform: 'none',
    display: 'block',
    color: 'white',
    'text-align': 'center',
    padding: '14px 16px',
    'text-decoration': 'none'
  };

  const insertApplyButtonStyle = {
    borderRadius: '8px',
    padding: '10px 20px',
    textTransform: 'none',
  }

  const { t } = useTranslation();

  const [isOpen, setState] = useState(false);
  const [identifier, setIdentifier] = useState("sysno");
  const [identifier_value, setIdentifierValue] = useState("");
  const [recordTextFields, setRecordTextFields] = useState(new RecordTextFields());


  const preFillRecord = (jsonData) => {
    recordTextFields.fromJson(jsonData);
  };

  const handleClickOpen = () => {
    setState(true);
  };

  const handleClose = () => {
    setState(false);
  };

  const handleChangeIdentifier = (value) => {
    setIdentifier(value);
  };

  const handlePreFill = () => {
    api.getPrecreateRecord(identifier, identifier_value)
            .then(jsonData => {
                preFillRecord(jsonData);
            })
            .catch(error => {
                console.error(error);
            });
  };

  const handleInsert = () => {
    api.createRecord(recordTextFields.getRecord());
    handleClose();
  };

  return (
    <div>
      <Button variant="text" onClick={handleClickOpen} style={insertDialogButtonStyle}>
        {t("insert_record_by_identifier")}
      </Button>
      <Dialog open={isOpen} onClose={handleClose}>
        <DialogTitle>{t("insert_record_by_identifier")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("insert_record_tooltip")}
          </DialogContentText>
          <Select
            id="identifier"
            value={identifier}
            label={t("identifier")}
            onChange={handleChangeIdentifier}
          >
            <MenuItem value={"sysno"}>{t("sysno")}</MenuItem>
          </Select>
          <TextField
            autoFocus
            margin="dense"
            id="identifier_value"
            label={t("identifier_value")}
            type="text"
            fullWidth
            variant="standard"
            onChange={(e) => setIdentifierValue(e.target.value)}
          />
          <Button variant='outlined' onClick={handlePreFill} style={insertApplyButtonStyle}>{t("fill_insert_record")}</Button>

          <RecordTextFields />
        </DialogContent>
        <DialogActions>
          <Button variant='outlined' onClick={handleClose} style={insertApplyButtonStyle}>{t("cancel")}</Button>
          <Button variant='outlined' onClick={handleInsert} style={insertApplyButtonStyle}>{t("insert_record_apply")}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

// export default withTranslation()(InsertByIdentifierDialog);
export default InsertByIdentifierDialog;
