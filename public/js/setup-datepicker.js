$(function() {
  $(".flatpickr-date").flatpickr({dateFormat: 'm/d/Y', allowInput: true});
  $(".flatpickr-datetime").flatpickr({dateFormat: 'm/d/Y h:i K', enableTime: true, allowInput: true});
})

function dateInputDefaults () {
  let dateInputsArr = document.getElementsByClassName('flatpickr-date');

  for (let i = 0; i < dateInputsArr.length; i++) {
    dateInputsArr[i].onfocusout = dateOnFocusOut;
  }
}

function dateOnFocusOut (e) {
  // trim whitespaces
  e.target.value = e.target.value.replace(/\s/g,'');   
}

dateInputDefaults();