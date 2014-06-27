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
 * Whether requestAutocomplete is supported by the user agent
 * @const
 */
var browserSupported = 'requestAutocomplete' in document.createElement('form');


/**
 * Whether the current Magento environment is supported.
 * @const
 */
var magentoSupported = methodsExist([
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
]);


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


/** Local alias for document.getElementById. */
var $ = function(id) { return document.getElementById(id); };


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
      var value = result[type];

      if (field.normalizer)
        value = field.normalizer(value);

      if (field.valueMap)
        value = field.valueMap[value];

      el.value = value || '';
    }

    return true;
  }

  return false;
}

/**
 * @param {HTMLFormElement} form A form to extract results from.
 * @return {Object} An object form of the fields in |form|.
 */
function getResultFromForm(form) {
  var name = {'billing': [], 'shipping': []};
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
  }

  return result;
}


/** @param {!Event} e A click event. */
function onClick(e) {
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
  var form = document.createElement('form');

  var ccTypes = [
    'cc-csc',
    'cc-exp-month',
    'cc-exp-year',
    'cc-name',
    'cc-number',
    'cc-type'
  ];

  // rAc currently requires some payment-specific types.
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
      clone.__originalInput__ = field;
      clone.setAttribute('autocomplete', type);
      form.appendChild(clone);
    }
  }

  addFields('billing');
  addFields('shipping');

  form.onautocompleteerror = function(e) {
    if (e.reason != 'cancel') {
      showNormalFlow();
      // Start the checkout flow (the original click that would've was halted).
      checkout.setMethod();
    }
  };

  form.onautocomplete = function() {
    var result = getResultFromForm(form);

    for (var i = 0; i < form.childNodes.length; ++i) {
      var field = form.childNodes[i];
      var value = result[field.getAttribute('autocomplete')];
      if (field.__originalInput__ && value)
        field.__originalInput__.value = value;
    }

    checkout.setMethod();

    billingRegionUpdater.update();
    shippingRegionUpdater.update();

    shipping.setSameAsBilling(false);
    $('billing:use_for_shipping_yes').checked = false;

    startFlow();
  };

  form.requestAutocomplete();
}


/** Enables the requestAutocomplete flow on the page. */
function enable() {
  if (!browserSupported)
    return;

  if (!magentoSupported) {
    console.info("This version of Magento isn't supported. Use .trigger() instead.");
    return;
  }

  document.addEventListener('click', onClick, true);

  document.body.classList.add('hide-sections');
  if (getCurrentStep() != 'login')
    document.body.classList.add('rac-flow');
}


/**
 * Disable the requestAutocomplete enhanced flow the next time a user clicks on
 * the guest checkout button. Does not cancel running rAc() flows.
 */
function disable() {
  if (!browserSupported || !magentoSupported)
    return;

  document.removeEventListener('click', onClick, true);
  showNormalFlow();
}


/** A way to manually trigger requestAutocomplete() for custom flows. */
function trigger(options) {
  options = options || {};

  function runCallbacks(result) {
    if (result && options.success)
      options.success(result);
    else if (!result && options.failure)
      options.failure(result);

    if (options.complete)
      options.complete(result);
  }

  if (!browserSupported) {
    runCallbacks(null);
    return;
  }

  // A random smattering of payment-specific [autocomplete] types.
  // http://www.whatwg.org/specs/web-apps/current-work/#attr-fe-autocomplete
  var billingAndShippingTypes = [
    'name',
    'given-name',
    'additional-name',
    'family-name',
    'street-address',
    'address-line1',
    'address-line2',
    'address-line3',
    'address-level1',
    'address-level2',
    'address-level3',
    'address-level4',
    'country',
    'country-name',
    'postal-code',
    'tel',
    'tel-country-code',
    'tel-national',
    'tel-area-code',
    'tel-local',
    'tel-local-prefix',
    'tel-local-suffix',
    'tel-extension',
    'email'
  ];

  for (var i = 0; i < billingAndShippingTypes.length; ++i) {
    var type = billingAndShippingTypes[i];

    var billingInput = document.createElement('input');
    billingInput.autocomplete = 'billing ' + type;
    form.appendChild(billingInput);

    var shippingInput = document.createElement('input');
    shippingInput.autocomplete = 'shipping ' + type;
    form.appendChild(shippingInput);
  }

  var ccTypes = [
    'cc-name',
    'cc-given-name',
    'cc-additional-name',
    'cc-family-name',
    'cc-number',
    'cc-exp',
    'cc-exp-month',
    'cc-exp-year',
    'cc-csc',
    'cc-type'
  ];

  for (var i = 0; i < ccTypes.length; ++i) {
    var ccInput = document.createElement('input');
    ccInput.autocomplete = ccTypes[i];
    form.appendChild(ccInput);
  }

  var form = document.createElement('form');

  form.onautocomplete = form.onautocompleteerror = function(e) {
    runCallbacks(e.type == 'autocomplete' ? getResultFromForm(form) : null);
  };

  form.requestAutocomplete();
}


/**
 * The public window.requestAutocomplete API.
 * Keys are 'quoted' to remain unchanged if closure compiled.
 */
window.requestAutocomplete = {
  'disable': disable,
  'enable': enable,
  'supported': browserSupported && magentoSupported,
  'trigger': trigger
};
}());


if (requestAutocomplete.supported) {
  if (document.readyState == 'complete')
    requestAutocomplete.enable();
  else
    window.addEventListener('DOMContentLoaded', requestAutocomplete.enable.bind(requestAutocomplete));
}
