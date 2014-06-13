// Copyright 2014 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * @fileoverview A library for integrating requestAutocomplete() with Magento's
 * checkout flow.
 * @author dbeam@chromium.org (Dan Beam)
 */
(function() {
/**
 * @type {!Array.<string>} methods A list of methods that need to exist.
 * @return {boolean} Whether all of |methods| exist.
 */
function methodsExist(methods) {
  for (var i = 0; i < methods.length; ++i) {
    var props = methods[i].split('.');
    var global = window[props[0]];
    if (!global || !global[props[1]])
      return false;
  }
  return true;
}


/**
 * Whether requestAutocomplete is supported by the user agent and whether the
 * current Magento environment is supported.
 * @type {!{browser: boolean, magento: boolean}}
 * @const
 */
var support = {
  'browser': 'requestAutocomplete' in document.createElement('form'),
  'magento': methodsExist([
      'billing.nextStep',
      'billing.save',
      'billingRegionUpdater.update',
      'checkout.setMethod',
      'payment.onSave',
      'payment.save',
      'payment.switchMethod',
      'shipping.nextStep',
      'shipping.save',
      'shippingMethod.onSave',
      'shippingMethod.save',
      'shippingRegionUpdater.update'
  ])
};


/**
 * The result of the last run of requestAutocomplete. null when rAc's last run
 * was a failure or it hasn't run at all yet.
 * @type {Object.<string, string>} A map of autocomplete type to values.
 */
var lastResult = null;


/**
 * A form created from multiple sections' fields to enable gathering all the
 * needed info in one call to requestAutocomplete().
 * @type {Element}
 */
var form = null;


/**
 * An overlay shown while checkout is being stepped through after a successful
 * rAc() run.
 */
var Overlay = {
  /** Creates an overlay element and shows it. */
  open: function() {
    if (!this.overlay_) {
      this.overlay_ = document.createElement('div');
      this.overlay_.className = 'window-overlay active';
      this.overlay_.id = 'filling-overlay';

      var message = document.createElement('div');
      message.id = 'filling-message';
      message.innerText = message.textContent = ' Checking out...';
      this.overlay_.appendChild(message);
    }
    document.body.appendChild(this.overlay_);
  },

  /** Hides the overlay and removes it from the DOM. */
  close: function() {
    if (this.overlay_ && this.overlay_.parentNode)
      this.overlay_.parentNode.removeChild(this.overlay_);
  }
};


/** Shows the non-rAc() flow. */
function showNormalFlow() {
  document.body.classList.remove('rac-flow', 'hide-sections');
  Overlay.close();
}


/** @return {string} The current checkout step. */
function getCurrentStep() {
  return checkout.currentStep || (document.querySelector('.section.active') || {id:''}).id.slice(4)
}


/** Starts/resumes the rAc() checkout flow. */
function startFlow() {
  var section;
  switch (getCurrentStep()) {
    case 'billing':
      section = billing;
      break;
    case 'shipping':
      section = shipping;
      break;
    case 'shipping_method':
      section = shippingMethod;
      break;
    case 'payment':
      section = payment;
      break;
    default:
      showNormalFlow();
      return;
  }

  if (!(section.validate ? section.validate() : new Validation(section.form).validate())) {
    showNormalFlow();
    return;
  }

  var prop = section == shippingMethod || section == payment ? 'onSave' : 'nextStep';
  var origMethod = section[prop];
  section[prop] = function(response) {
    var parsed = {};
    try { parsed = JSON.parse(response.responseText); } catch(e) {}

    if (parsed.error)  // Show the section before alert() is called.
      showNormalFlow();

    var previousStep = getCurrentStep();

    origMethod.apply(section, arguments);
    section[prop] = origMethod;

    var currentStep = getCurrentStep();
    if (previousStep == currentStep || (currentStep == 'payment' && !fillPaymentForm())) {
      // There was some kind of error. Revert to the non-rAc() flow.
      showNormalFlow();
      return;
    }

    if (currentStep == 'payment' || currentStep == 'shipping')
      setTimeout(startFlow);  // Sections that should be auto-advanced through.
    else
      Overlay.close();  // Sections that require user input.
  };

  Overlay.open();
  document.body.classList.add('hide-sections', 'rac-flow');

  section.save();
}


/** @return {boolean} Whether filling succeeded. */
function fillPaymentForm() {
  /** Payment methods currently supported by this extension. */
  var methods = ['authorizenet', 'ccsave'];

  for (var i = 0; i < methods.length; ++i) {
    var method = methods[i];
    var methodRadio = $('p_method_' + method);
    if (!methodRadio || !$('payment_form_' + method))
      continue;

    payment.switchMethod(method);
    if (payment.currentMethod != method)
      continue;

    methodRadio.checked = true;

    var ccTypeValueMap = {
      'Visa': 'VI',
      'MasterCard': 'MC',
      'American Express': 'AE',
      'Discover': 'DI'
    };

    /**
     * Normalizes number-like inputs (e.g. '1', '01', ' 1' => '1').
     * @param {string} val A number-like value.
     * @return {string} A more normal number-like value.
     */
    function numberish(val) {
      return '' + parseInt(val, 10);
    }

    var fields = [
      {suffix: 'cc_cid', type: 'cc-csc'},
      {suffix: 'cc_number', type: 'cc-number'},
      {suffix: 'cc_owner', type: 'cc-name'},
      {suffix: 'cc_type', type: 'cc-type', valueMap: ccTypeValueMap},
      {suffix: 'expiration', type: 'cc-exp-month', normalizer: numberish},
      {suffix: 'expiration_yr', type: 'cc-exp-year'}
    ];

    for (var j = 0; j < fields.length; ++j) {
      var field = fields[j];
      var el = $(method + '_' + field.suffix);
      if (!el)
        continue;

      var type = field.type;
      var result = lastResult[type];

      if (field.normalizer)
        result = field.normalizer(result);

      if (field.valueMap)
        result = field.valueMap[result];

      el.value = result || '';
    }

    return true;
  }

  return false;
}

/**
 * Called on both success and failure to unregister events and remove extra
 * cruft from the DOM.
 * @param {Object} result The results of the last run of requestAutocomplete.
 */
function cleanUp(result) {
  form.removeEventListener('autocomplete', success);
  form.removeEventListener('autocompleteerror', failure);
  form = null;
  lastResult = result;
}


/**
 * Called when requestAutocomplete succeeds in filling in a form.
 * @param {!Event} e The successful 'autocomplete' event.
 */
function success(e) {
  var name = {'billing': [], 'shipping': []};
  var shipName = [];
  var result = {};

  for (var i = 0; i < form.childNodes.length; ++i) {
    var field = form.childNodes[i];
    var type = field.getAttribute('autocomplete');
    var tokens = type.split(' ');
    var section = tokens.length > 1 ? tokens[0] : '';

    // See http://crbug.com/241886 for why this code splits names.
    if (type == section + ' name')
      name[section] = field.value.split(' ');

    var value = field.value;

    if (type == 'billing country' && value.length > 2)  // http://crbug.com/382777
      value = 'US';
    else if (!value && type == section + ' given-name')
      value = name[section][0] || '';
    else if (!value && type == section + ' family-name')
      value = name[section].slice(-1)[0] || '';

    result[type] = value;

    if (field.__originalInput__)
      field.__originalInput__.value = value;
  }

  cleanUp(result);

  if (support.magento) {
    checkout.setMethod();

    billingRegionUpdater.update();
    shippingRegionUpdater.update();

    shipping.setSameAsBilling(false);
    $('billing:use_for_shipping_yes').checked = false;

    startFlow();
  }
}


/**
 * Called when requestAutocomplete fails (and an 'autocompleteerror' event is
 * dispatched.
 * @param {!AutocompleteErrorEvent} e The failure event.
 */
function failure(e) {
  if (e.reason == 'cancel') {
    cleanUp(lastResult);  // Don't change the lastResult on cancels.
    return;
  }

  showNormalFlow();
  cleanUp(null);

  // Start the checkout flow (the original click that would've was halted).
  checkout.setMethod();
}


/** @param {!Event} e A click event. */
function onClick(e) {
  if (form) {
    // rAc() flow is already active.
    return;
  }

  var $ = document.getElementById.bind(document);

  var triggers = [
    {
      selector: '#onepage-guest-register-button',
      test: function() {
        var guest = $('login:guest');
        return guest && guest.checked;
      }
    },
    {selector: '#billing-progress-opcheckout .changelink a'},
    {selector: '#shipping-progress-opcheckout .changelink a'},
    {selector: '#payment-progress-opcheckout .changelink a'},
    {selector: '#opc-billing.allow .step-title'},
    {selector: '#opc-shipping.allow .step-title'},
    {selector: '#opc-payment.allow .step-title'},
    {selector: '#shipping-method-buttons-container button'}
  ];

  var isTrigger = false;
  var target = e.target;

  for (var i = 0; i < triggers.length; ++i) {
    var trigger = triggers[i];
    var el = document.querySelector(trigger.selector);
    if (el && el.contains(target) && (!trigger.test || trigger.test(target))) {
      isTrigger = true;
      break;
    }
  }

  if (!isTrigger) {
    if ($('onepage-guest-register-button').contains(target))
      showNormalFlow();
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  if ($('shipping-method-buttons-container').contains(target)) {
    startFlow();
    return;
  }

  // Create a form with all the needed fields to only invoke rAc() once.
  form = document.createElement('form');

  var ccTypes = [
    'cc-csc',
    'cc-exp-month',
    'cc-exp-year',
    'cc-name',
    'cc-number',
    'cc-type'
  ];

  // rAc currently requires payment-specific types.
  for (var i = 0; i < ccTypes.length; ++i) {
    var input = document.createElement('input')
    input.setAttribute('autocomplete', ccTypes[i]);
    form.appendChild(input);
  }

  var billingName = document.createElement('input');
  billingName.setAttribute('autocomplete', 'billing name');
  form.appendChild(billingName);

  var shippingName = document.createElement('input');
  shippingName.setAttribute('autocomplete', 'shipping name');
  form.appendChild(shippingName);

  /**
   * Adds form fields from |section| into |form| so they can be filled.
   * @param {string} section The section of the checkout flow (e.g. shipping).
   */
  function addFields(section) {
    var sectionForm = $('co-' + section + '-form');
    sectionForm.reset();

    var fields = sectionForm.querySelectorAll('[name^=' + section + '\\[]');
    if (!fields.length)
      return;

    var namesToTypes = {
      'firstname': 'given-name',
      'lastname': 'family-name',
      'company': 'organization',
      'email': 'email',
      // NOTE: street address lines are handled separately.
      'city': 'locality',
      'region': 'region',
      'region_id': 'region',
      'postcode': 'postal-code',
      'country_id': 'country',
      'telephone': 'tel'
      // TODO: support fax?
    };

    var addressLine = 1;

    for (var i = 0; i < fields.length; ++i) {
      var field = fields[i];
      var name = field.getAttribute('name')

      var type;
      var name = name.slice((section + '[').length, -']'.length);
      if (name == 'street][') {
        type = 'address-line' + addressLine;
        addressLine++;
      } else {
        type = namesToTypes[name];
      }
      if (!type)
        continue;

      // Prepend 'billing ' or 'shipping ' to the [autocomplete] type.
      type = section + ' ' + type;

      var clone = field.cloneNode(true);
      clone.setAttribute('autocomplete', type);
      form.appendChild(clone);

      if (support.magento)
        clone.__originalInput__ = field;
    }
  }

  addFields('billing');
  addFields('shipping');

  form.addEventListener('autocomplete', success);
  form.addEventListener('autocompleteerror', failure);

  form.requestAutocomplete();
}


/** Enables the requestAutocomplete flow on the page. */
function enable() {
  if (!support.browser)
    return;

  document.addEventListener('click', onClick, true);

  if (support.magento) {
    document.body.classList.add('hide-sections');
    if (getCurrentStep() != 'login')
      document.body.classList.add('rac-flow');
  }
}


/**
 * Disable the requestAutocomplete enhanced flow the next time a user clicks on
 * the guest checkout button. Does not cancel running rAc() flows.
 */
function disable() {
  if (!support.browser)
    return;

  document.removeEventListener('click', onClick, true);
  showNormalFlow();
}


/**
 * The public window.requestAutocomplete API.
 * Keys are 'quoted' to remain unchanged if closure compiled.
 */
window.requestAutocomplete = {
  'disable': disable,
  'enable': enable,
  'getLastResult': function() { return lastResult; },
  'support': support,
  'supported': support.browser && support.magento
};


}());


if (requestAutocomplete.supported) {
  if (document.readyState == 'complete')
    requestAutocomplete.enable();
  else
    window.addEventListener('DOMContentLoaded', requestAutocomplete.enable.bind(requestAutocomplete));
}
