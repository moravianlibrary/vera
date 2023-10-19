import React, { useState, useEffect } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import Paper from '@material-ui/core/Paper';
import { useTranslation } from "react-i18next";

import { api } from '../services/Api';
import { Record } from '../models/Record';
import RecordTextFields from '../components/RecordTextFields';

const EditRecordDialog = ({ selectedRecord, onClose, onUpdateRecord, onDeleteRecord }) => {
  const dialogActionsStyle = {
    'margin-right': '20px',
    'margin-left': '20px',
    justifyContent: 'space-between',
  };
  const baseButtonStyle = {
    borderRadius: '8px',
    padding: '10px 20px',
    textTransform: 'none',
    margin: '5px',
  }
  const deleteButtonStyle = {
    borderRadius: '8px',
    padding: '10px 20px',
    textTransform: 'none',
    margin: '5px',
    color: 'white',
    backgroundColor: '#b92f3f',
    border: '2px solid #a51b2b',
  }

  const { t } = useTranslation();

  const [refreshCount, setRefreshCount] = useState(0);
  const [record, setRecord] = useState(selectedRecord ? selectedRecord : new Record());
  const [minWidth, setMinWidth] = useState('50%');

  useEffect(() => {
    const screenWidth = window.innerWidth;
    const calculatedMinWidth = Math.max(0.2 * screenWidth, 480); // 20% or at least 320px
    setMinWidth(calculatedMinWidth + 'px');
  });

  const handleRecordChange = (updatedRecord) => {
    setRecord(updatedRecord);
  }

  const handleClose = () => {
    if (typeof onClose === 'function') {
      onClose();
    }
  };

  const handleUpdate = () => {
    if (typeof onUpdateRecord === 'function') {
      onUpdateRecord(record);
    }
    handleClose();
  };

  const handleDelete = () => {
    if (typeof onDeleteRecord === 'function') {
      onDeleteRecord(record);
    }
    handleClose();
  };

  return (
    <div>
      <Dialog open={true} onClose={handleClose} maxWidth='lg'>
        <Paper style={{ minWidth }}>
          <DialogTitle>{t("insert_record_title")}</DialogTitle>
          <DialogContent>
            <DialogContentText>
              {t("insert_record_tooltip")}
            </DialogContentText>

            <RecordTextFields record={record} onRecordChange={handleRecordChange} key={refreshCount} />
          </DialogContent>
          <DialogActions style={dialogActionsStyle}>
            <div>
              <Button variant='outlined' onClick={handleDelete} style={deleteButtonStyle}>{t("delete_record_apply")}</Button>
            </div>
            <div>
              <Button variant='outlined' onClick={handleClose} style={baseButtonStyle}>{t("cancel")}</Button>
              <Button variant='outlined' onClick={handleUpdate} style={baseButtonStyle}>{t("update_record_apply")}</Button>
            </div>
          </DialogActions>
        </Paper>
      </Dialog>
    </div>
  );
};

export default EditRecordDialog;
