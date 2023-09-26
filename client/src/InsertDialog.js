import React, { useState, useRef } from 'react';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import TextField from '@material-ui/core/TextField';

const InsertDialog = () => {
  const customButtonStyle = {
    // borderRadius: '8px', // Add border radius
    padding: '10px 20px', // Adjust padding
    textTransform: 'none',
  };

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
      <Button variant="text" onClick={handleClickOpen} style={customButtonStyle}>
        Vytvořit nový záznam
      </Button>
      <Dialog open={isOpen} onClose={handleClose}>
        <DialogTitle>Subscribe</DialogTitle>
        <DialogContent>
          <DialogContentText>
            To subscribe to this website, please enter your email address here. We
            will send updates occasionally.
          </DialogContentText>
          <TextField
            autoFocus
            margin="dense"
            id="sysno"
            label="Sysno"
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="volume_number"
            label="Volume Number"
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="item_number"
            label="Item Number"
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="category"
            label="Category"
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="title"
            label="Title"
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="pages_count"
            label="Pages Count"
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
            label="Signature"
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="issn"
            label="ISSN"
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="isbn"
            label="ISBN"
            type="text"
            fullWidth
            variant="standard"
          />
          <TextField
            margin="dense"
            id="barcode"
            label="Barcode"
            type="text"
            fullWidth
            variant="standard"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleClose}>Subscribe</Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default InsertDialog;
