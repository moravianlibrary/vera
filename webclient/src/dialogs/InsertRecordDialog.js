import React, { useState, useEffect } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Typography from '@material-ui/core/Typography';
import Paper from '@material-ui/core/Paper';
import { MenuItem } from '@material-ui/core';
import { Select } from '@material-ui/core';
import TextField from '@material-ui/core/TextField';
import { useTranslation } from "react-i18next";

import { api } from '../services/Api';
import { Record } from '../models/Record';
import RecordTextFields from '../components/RecordTextFields';

const InsertRecordDialog = ({ onRefresh }) => {
  const insertDialogButtonStyle = {
    textTransform: 'none',
    display: 'block',
    color: 'white',
    'text-align': 'center',
    padding: '14px 16px',
    'text-decoration': 'none',
  };
  const dialogActionsStyle = {
    'margin-right': '20px',
  };
  const insertApplyButtonStyle = {
    borderRadius: '8px',
    padding: '10px 20px',
    textTransform: 'none',
    margin: '5px'
  }
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    border: '1px solid #ccc',
    padding: '20px',
    borderRadius: '8px',
    margin: '10px'
  };
  const containerHeaderStyle = {
    'margin-bottom': '15px'
  };

  const { t } = useTranslation();

  const [isOpen, setState] = useState(false);
  const [refreshCount, setRefreshCount] = useState(0);
  const [identifier, setIdentifier] = useState("sysno");
  const [identifier_value, setIdentifierValue] = useState("");
  const [record, setRecord] = useState(new Record());
  const [minWidth, setMinWidth] = useState('50%');

  useEffect(() => {
    const screenWidth = window.innerWidth;
    const calculatedMinWidth = Math.max(0.2 * screenWidth, 480); // 20% or at least 320px
    setMinWidth(calculatedMinWidth + 'px');
  }, [isOpen]);


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

  const preFillRecord = (jsonData) => {
    setRecord(Record.fromJson(jsonData));
    handleRefresh();
  };

  const handleClear = () => {
    setRecord(new Record());
    handleRefresh();
  };

  const handleRefresh = () => {
    setRefreshCount(refreshCount + 1);
  };

  const handleRecordChange = (record) => {
    setRecord(record);
  }

  const handleInsert = () => {
    api.createRecord(record);
    handleClear();
    if (typeof onRefresh === 'function') {
      onRefresh();
    }
    handleClose();
  };

  return (
    <div>
      <Button variant="text" onClick={handleClickOpen} style={insertDialogButtonStyle}>
        {t("insert_record_title")}
      </Button>
      <Dialog open={isOpen} onClose={handleClose} maxWidth='lg'>
        <Paper style={{ minWidth }}>
          <DialogTitle>{t("insert_record_title")}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t("insert_record_tooltip")}
            </DialogContentText>
            <Paper elevation={3} style={containerStyle}>
              <Typography variant="h6" style={containerHeaderStyle}>
              {t("fill_insert_title")}
              </Typography>
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
            </Paper>

            <RecordTextFields record={record} onRecordChange={handleRecordChange} key={refreshCount} />
          </DialogContent>
          <DialogActions style={dialogActionsStyle}>
            <Button variant='outlined' onClick={handleClose} style={insertApplyButtonStyle}>{t("cancel")}</Button>
            <Button variant='outlined' onClick={handleClear} style={insertApplyButtonStyle}>{t("clear")}</Button>
            <Button variant='outlined' onClick={handleInsert} style={insertApplyButtonStyle}>{t("insert_record_apply")}</Button>
          </DialogActions>
        </Paper>
      </Dialog>
    </div>
  );
};

export default InsertRecordDialog;
