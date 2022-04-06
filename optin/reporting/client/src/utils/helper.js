const Helper = {
	toRelativeAmount: amount => amount / (10 ** 6),
	downloadFile: ({ data, fileName, fileType }) => {
		const blob = new Blob([data], { type: fileType });
  
		const a = document.createElement('a');
		a.download = fileName;
		a.href = window.URL.createObjectURL(blob);
		const clickEvt = new MouseEvent('click', {
			view: window,
			bubbles: true,
			cancelable: true
		});
		a.dispatchEvent(clickEvt);
		a.remove();
	}
};

export default Helper;