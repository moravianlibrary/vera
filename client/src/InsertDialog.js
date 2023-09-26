import React, { useState, useRef } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';
import { useTranslation } from "react-i18next";

const InsertDialog = () => {
  const insertDialogButtonStyle = {
    padding: '10px 20px',
    textTransform: 'none',
  };

  const insertApplyButtonStyle = {
    borderRadius: '8px',
    padding: '10px 20px',
    textTransform: 'none',
  }

  const { t } = useTranslation();

  const [isOpen, setState] = useState(false);

  const handleClickOpen = () => {
    setState(true);
  };

  const handleClose = () => {
    setState(false);
  };

  const handleInsert = () => {
    handleClose();
  };

  return (
    <div>
      <Button variant="text" onClick={handleClickOpen} style={insertDialogButtonStyle}>
        {t("insert_record_title")}
      </Button>
      <Dialog open={isOpen} onClose={handleClose}>
        <DialogTitle>{t("insert_record_title")}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t("insert_record_tooltip")}
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="sysno"
            label={t("sysno")}
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="volume_number"
            label={t("volume_number")}
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="item_number"
            label={t("item_number")}
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="category"
            label={t("category")}
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="title"
            label={t("title")}
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="pages_count"
            label={t("pages_count")}
            type="text"
            fullWidth
            variant="standard"
            inputProps={{
              inputMode: 'numeric',
              pattern: '[0-9]*', // Allow only numbers (0-9)
            }}
          />
          <TextField
            margin="dense"
            id="signature"
            label={t("signature")}
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="issn"
            label={t("issn")}
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="isbn"
            label={t("isbn")}
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="barcode"
            label={t("barcode")}
            type="text"
            fullWidth
            variant="standard"
          />
        </DialogContent>
        <DialogActions>
          <Button variant='outlined' onClick={handleClose} style={insertApplyButtonStyle}>{t("cancel")}</Button>
          <Button variant='outlined' onClick={handleInsert} style={insertApplyButtonStyle}>{t("insert_record_apply")}</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default InsertDialog;
