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
 * @fileoverview An API to integrate requestAutocomplete() w/ Magento checkout.
 * @author dbeam@chromium.org (Dan Beam)
 */
window['requestAutocomplete'] = (function() {


////////////////////////////////////////////////////////////////////////////////
// Static functions

/**
 * Local alias for document.getElementById.
 * @param {string} id An ID to search for.
 * @return {Element} An element with |id| or null if not found.
 */
var $ = function(id) { return document.getElementById(id); };


/**
 * Adds a static |getInstance()| method that always returns the same instance.
 * @param {!Function} ctor Class constructor to add |getInstance()| to.
 */
function addSingletonGetter(ctor) {
  ctor.getInstance = function() {
    return ctor.instance_ || (ctor.instance_ = new ctor());
  };
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

    if (value)
      result[type] = value;
  }

  return result;
}


////////////////////////////////////////////////////////////////////////////////
// Support

/**
 * A helper to determine whether a browser or Magento environment is supported.
 * @constructor
 */
function Support() {
  this.isBrowserSupported_ = this.isRequestAutocompletePresent_();
  this.isMagentoSupported_ = this.areRequiredMagentoMethodsPresent_();
}

addSingletonGetter(Support);


/**
 * Whether the current Magento environment is supported.
 * @const
 */
Support.prototype.requiredMagentoMethods_ = [
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
  'shippingRegionUpdater.update',
  'Validation'
];


/**
 * @return {boolean} Whether all of |this.requiredMagentoMethods_| exist.
 * @private
 */
Support.prototype.areRequiredMagentoMethodsPresent_ = function() {
  for (var i = 0; i < this.requiredMagentoMethods_.length; ++i) {
    var props = this.requiredMagentoMethods_[i].split('.');
    var global = window[props[0]];
    if (!global || (props[1] && !global[props[1]]))
      return false;
  }
  return true;
};


/**
 * @return {boolean} Whether requestAutocomplete is supported by the browser.
 * @const
 */
Support.prototype.isRequestAutocompletePresent_ = function() {
  return 'requestAutocomplete' in document.createElement('form');
};


/**
 * @return {boolean} Whether the current browser is supported.
 */
Support.prototype.isBrowserSupported = function() {
  return this.isBrowserSupported_;
};


/**
 * @return {boolean} Whether the current Magento environment is supported.
 */
Support.prototype.isMagentoSupported = function() {
  return this.isMagentoSupported_;
};


/**
 * @return {boolean} Whether the current browser is supported.
 */
Support.isBrowserSupported = function() {
  return Support.getInstance().isBrowserSupported();
};


/**
 * @return {boolean} Whether the current Magento environment is supported.
 */
Support.isMagentoSupported = function() {
  return Support.getInstance().isMagentoSupported();
};


////////////////////////////////////////////////////////////////////////////////
// Overlay

/**
 * An overlay that shows while a MagentoFlow is progressing.
 * @constructor
 */
function Overlay() {}

addSingletonGetter(Overlay);


/** Creates an overlay element and shows it. */
Overlay.prototype.open = function() {
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
};


/** Hides the overlay and removes it from the DOM. */
Overlay.prototype.close = function() {
  if (this.overlay_ && this.overlay_.parentNode)
    this.overlay_.parentNode.removeChild(this.overlay_);
};


Overlay.open = function() {
  Overlay.getInstance().open();
};


Overlay.close = function() {
  Overlay.getInstance().close();
};


////////////////////////////////////////////////////////////////////////////////
// MagentoFlow

/** @constructor */
function MagentoFlow() {}

addSingletonGetter(MagentoFlow);


/**
 * Selectors of elements that should trigger rAc() when clicked.
 * @type {!Array.<{selector: string, test: (!Function|undefined)}>}
 */
MagentoFlow.prototype.clickTriggers_ = [
  {
    selector: '#onepage-guest-register-button',
    test: function() {
      var guest = $('login:guest');
      return guest && guest.checked;
    }
  },
  {
    selector: '#billing-progress-opcheckout .changelink a'
  },
  {
    selector: '#shipping-progress-opcheckout .changelink a'
  },
  {
    selector: '#payment-progress-opcheckout .changelink a'
  },
  {
    selector: '#opc-billing.allow .step-title'
  },
  {
    selector: '#opc-shipping.allow .step-title'
  },
  {
    selector: '#opc-payment.allow .step-title'
  },
  {
    selector: '#shipping-method-buttons-container button'
  }
];


/**
 * [autocomplete] types that are added to the rAc() <form>. 
 * @const
 */
MagentoFlow.prototype.addedAutocompleteTypes_ = [
  // The payment <form> is not renderer when the flow starts. Add a set of cc-*
  // fields and remember the result so the payment section can be filled later.
  'cc-csc',
  'cc-exp-month',
  'cc-exp-year',
  'cc-name',
  'cc-number',
  'cc-type',,

  // Certain versions of Chrome only fill whole name whereas Magento asks for
  // first/last name. Split the whole name ourselves if we must.
  'billing name',
  'shipping name'
];


/**
 * A map of Magento's billing/shipping input[name] to [autocomplete] equivalent.
 */
MagentoFlow.prototype.billingAndShippingNameTypeMap_ = {
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


/**
 * Payment methods currently supported by this extension.
 * @const
 */
MagentoFlow.prototype.paymentMethods_ = [
  'authorizenet',
  'ccsave'
];


/**
 * A list of credit card fields shared by most Magento payment forms.
 * @type {!Array.<{idSuffix: string, type: string, valueMap: (Object|undefined),
 *                 normalizer: (function(string):string|undefined)}>}
 */
MagentoFlow.prototype.paymentFormFields_ = [
  {
    idSuffix: 'cc_cid',
    type: 'cc-csc'
  },
  {
    idSuffix: 'cc_number',
    type: 'cc-number'
  },
  {
    idSuffix: 'cc_owner',
    type: 'cc-name'
  },
  {
    idSuffix: 'cc_type',
    type: 'cc-type',
    valueMap: {
      'Visa': 'VI',
      'MasterCard': 'MC',
      'American Express': 'AE',
      'Discover': 'DI'
    }
  },
  {
    idSuffix: 'expiration',
    type: 'cc-exp-month',
    normalizer: function(val) {
      // Normalizes number-like month values (e.g. '1', '01', ' 1' => '1').
      return parseInt(val, 10);
    }
  },
  {
    idSuffix: 'expiration_yr',
    type: 'cc-exp-year'
  }
];


/**
 * Integrates requestAutocomplete into the Magento checkout flow.
 * @return {boolean} Whether the flow is supported on this page.
 */
MagentoFlow.prototype.enable = function() {
  if (!this.isSupported_())
    return false;

  this.boundOnClick_ = this.onClick_.bind(this);
  document.addEventListener('click', this.boundOnClick_, true);

  document.body.classList.add('hide-sections');
  if (this.getCurrentStep_() != 'login')
    document.body.classList.add('rac-flow');

  return true;
};


/**
 * Disable the rAc() Magento flow and reshow checkout sections. Does not hide
 * rAc() UI if already showing.
 */
MagentoFlow.prototype.disable = function() {
  if (!this.isSupported_())
    return;

  document.removeEventListener('click', this.boundOnClick_, true);
  delete this.boundOnClick_;

  this.abortFlow_();
};


/** @param {!Event} e A click event. */
MagentoFlow.prototype.onClick_ = function(e) {
  var isTrigger = false;
  var target = e.target;

  for (var i = 0; i < this.clickTriggers_.length; ++i) {
    var trigger = this.clickTriggers_[i];
    var el = document.querySelector(trigger.selector);
    if (el && el.contains(target) && (!trigger.test || trigger.test(target))) {
      isTrigger = true;
      break;
    }
  }

  if (!isTrigger) {
    if ($('onepage-guest-register-button').contains(target))
      this.abortFlow_();
    return;
  }

  e.preventDefault();
  e.stopPropagation();

  if ($('shipping-method-buttons-container').contains(target)) {
    this.startFlow_();
    return;
  }

  // Create a form with all the needed fields to only invoke rAc() once.
  this.racForm_ = document.createElement('form');

  for (var i = 0; i < this.addedAutocompleteTypes_.length; ++i) {
    var input = document.createElement('input')
    input.setAttribute('autocomplete', this.addedAutocompleteTypes_[i]);
    this.racForm_.appendChild(input);
  }

  this.addFieldsFromSection_(billing);
  this.addFieldsFromSection_(shipping);

  this.racForm_.onautocomplete = this.onAutocomplete_.bind(this);
  this.racForm_.onautocompleteerror = this.onAutocompleteerror_.bind(this);

  this.racForm_.requestAutocomplete();
};


/**
 * Shows the normal Magento flow (e.g. the non-rAc() flow).
 */
MagentoFlow.prototype.abortFlow_ = function() {
  document.body.classList.remove('rac-flow', 'hide-sections');
  Overlay.close();
};


/** @return {?string} The current checkout step or null if none. */
MagentoFlow.prototype.getCurrentStep_ = function() {
  // Newer versions of Magento have the current step available as part of the
  // public API. If this is present, use it.
  if (checkout.currentStep)
    return checkout.currentStep;
    
  // Else derive the current step from the DOM.
  var activeSection = document.querySelector('.section.active');
  if (activeSection)
    return activeSection.id.replace(/^opc-/, '');

  return null;
};


/**
 * Starts/resumes the rAc() checkout flow.
 */
MagentoFlow.prototype.startFlow_ = function() {
  var section;
  switch (this.getCurrentStep_()) {
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
      this.abortFlow_();
      return;
  }

  if (!this.isSectionValid_(section)) {
    this.abortFlow_();
    return;
  }

  var onSaveSection = section == shippingMethod || section == payment;
  var methodToReplace = onSaveSection ? 'onSave' : 'nextStep';

  var origMethod = section[methodToReplace];
  section[methodToReplace] = function(response) {
    var parsed = {};
    try { parsed = JSON.parse(response.responseText); } catch(e) {}

    if (parsed.error)  // Show the section before alert() is called.
      this.abortFlow_();

    var previousStep = this.getCurrentStep_();

    origMethod.apply(section, arguments);
    section[methodToReplace] = origMethod;

    var currentStep = this.getCurrentStep_();
    if (previousStep == currentStep ||
        (currentStep == 'payment' && !this.fillPaymentForm_())) {
      // There was some kind of error. Revert to the non-rAc() flow.
      this.abortFlow_();
      return;
    }

    if (currentStep == 'payment' || currentStep == 'shipping')
      setTimeout(this.startFlow_.bind(this));  // Auto-advance to next section.
    else
      Overlay.close();  // Sections that require user input.
  }.bind(this);

  Overlay.open();
  document.body.classList.add('hide-sections', 'rac-flow');

  section.save();
};


/**
 * @param {!Object} section A possibly valid Magento section object.
 * @return {boolean} Whether |section| is valid;
 */
MagentoFlow.prototype.isSectionValid_ = function(section) {
  if (section.validate)
    return section.validate();
   
  return new Validation(section.form).validate();
};


/** @return {boolean} Whether filling succeeded. */
MagentoFlow.prototype.fillPaymentForm_ = function() {
  for (var i = 0; i < this.paymentMethods_.length; ++i) {
    var method = this.paymentMethods_[i];
    var methodRadio = $('p_method_' + method);
    if (!methodRadio || !$('payment_form_' + method))
      continue;

    payment.switchMethod(method);
    if (payment.currentMethod != method)
      continue;

    methodRadio.checked = true;

    for (var j = 0; j < this.paymentFormFields_.length; ++j) {
      var field = this.paymentFormFields_[j];
      var el = $(method + '_' + field.idSuffix);
      if (!el)
        continue;

      var type = field.type;
      var value = this.result_[type];

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
 * @param {Object} section A Magento section (e.g. shippingMethod).
 * @return {string} Name of the Magento section.
 * @private
 */
MagentoFlow.prototype.getNameOfSection_ = function(section) {
  return section.form.replace(/^co-|-form$/g, '');
};


/**
 * @param {Object} section A part of the Magento checkout flow (e.g. shipping).
 * @return {NodeList} A list of fields from |section|.
 */
MagentoFlow.prototype.getFieldsFromSection_ = function(section) {
  var name = this.getNameOfSection_(section);
  return $(section.form).querySelectorAll('[name^=' + name + '\\[]');
};


/**
 * Adds form fields from |section| into |form| so they can be filled.
 * @param {Object} section The section of the checkout flow (e.g. shipping).
 */
MagentoFlow.prototype.addFieldsFromSection_ = function(section) {
  $(section.form).reset();

  var fields = this.getFieldsFromSection_(section);
  var sectionName = this.getNameOfSection_(section);
  var addressLine = 1;

  for (var i = 0; i < fields.length; ++i) {
    var field = fields[i];
    var name = field.getAttribute('name').slice((sectionName + '[').length, -']'.length);

    var type;
    if (name == 'street][') {
      // Special case street address array input (e.g. section[street][]).
      type = 'address-line' + addressLine;
      addressLine++;
    } else {
      type = this.billingAndShippingNameTypeMap_[name];
    }
    if (!type)
      continue;

    // Prepend the section to the type (e.g. 'shipping ' + 'name').
    type = sectionName + ' ' + type;

    var clone = field.cloneNode(true);
    clone.setAttribute('autocomplete', type);

    // A mapping to source input for faster/easier filling after rAc() has run.
    clone.__sourceInput__ = field;

    this.racForm_.appendChild(clone);
  }
};


/**
 * Handles autocomplete events (e.g. successfully rAc() runs).
 * @private
 */
MagentoFlow.prototype.onAutocomplete_ = function(e) {
  this.result_ = getResultFromForm(this.racForm_);

  for (var i = 0; i < this.racForm_.childNodes.length; ++i) {
    var field = this.racForm_.childNodes[i];
    if (!field.__sourceInput__)
      continue;

    var value = this.result_[field.getAttribute('autocomplete')];
    if (value)
      field.__sourceInput__.value = value;

    delete field.__sourceInput__;
  }

  checkout.setMethod();

  billingRegionUpdater.update();
  shippingRegionUpdater.update();

  shipping.setSameAsBilling(false);
  $('billing:use_for_shipping_yes').checked = false;

  this.startFlow_();
};


/**
 * Handles autocompleteerror events (e.g. a failed rAc() run).
 * @param {Event} e An autocompleteerror event.
 * @private
 */
MagentoFlow.prototype.onAutocompleteerror_ = function(e) {
  if (e.reason == 'cancel') {
    // Don't abort the flow on a cancel.
    return;
  }

  this.abortFlow_();

  // Start the checkout flow (the original click that would've was halted).
  checkout.setMethod();
};


/** @return {boolean} Whether the flow is supported. */
MagentoFlow.prototype.isSupported_ = function() {
  return Support.isBrowserSupported() && Support.isMagentoSupported();
};


/** @return {boolean} Whether enabling the flow succeeded. */
MagentoFlow.enable = function() {
  return MagentoFlow.getInstance().enable();
};


MagentoFlow.disable = function() {
  MagentoFlow.getInstance().disable();
};


////////////////////////////////////////////////////////////////////////////////
// CustomFlow

/**
 * A way to manually trigger requestAutocomplete() for custom flows.
 * @param {function(Object)} success Callback for successful rAc() runs.
 * @param {Function=} opt_failure Callback for rAc() errors.
 * @param {boolean=} opt_billingOnly Whether to only ask for billing info.
 * @constructor
 */
function CustomFlow(success, opt_failure, opt_billingOnly) {
  /**
   * @type {!Function}
   * @private
   */
  this.success_ = success;

  /**
   * @type {!Function}
   * @private
   */
  this.failure_ = opt_failure || function() {};

  /**
   * @type {boolean}
   * @private
   */
  this.billingOnly_ = !!opt_billingOnly;
}


/**
 * A random smattering of payment-specific [autocomplete] types.
 * http://www.whatwg.org/specs/web-apps/current-work/#attr-fe-autocomplete
 * @private
 * @const
 */
CustomFlow.prototype.billingAndShippingTypes_ = [
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


/**
 * All the cc-* [autocomplete] types currently in the spec.
 * http://www.whatwg.org/specs/web-apps/current-work/#attr-fe-autocomplete
 * @private
 * @const
 */
CustomFlow.prototype.ccTypes_ = [
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


/**
 * Builds a <form> and invokes requestAutocomplete() on it. Results are passed
 * to the callbacks in |this.options_|.
 * @return {boolean} Whether the flow was run.
 */
CustomFlow.prototype.run = function() {
  if (!Support.isBrowserSupported()) {
    this.gotResult_(null);
    return false;
  }

  this.racForm_ = document.createElement('form');

  for (var i = 0; i < this.billingAndShippingTypes_.length; ++i) {
    var type = this.billingAndShippingTypes_[i];

    var billingInput = document.createElement('input');
    billingInput.autocomplete = 'billing ' + type;
    this.racForm_.appendChild(billingInput);

    if (!this.billingOnly_) {
      var shippingInput = document.createElement('input');
      shippingInput.autocomplete = 'shipping ' + type;
      this.racForm_.appendChild(shippingInput);
    }
  }

  for (var i = 0; i < this.ccTypes_.length; ++i) {
    var ccInput = document.createElement('input');
    ccInput.autocomplete = this.ccTypes_[i];
    this.racForm_.appendChild(ccInput);
  }

  this.racForm_.onautocomplete = this.onAutocomplete_.bind(this);
  this.racForm_.onautocompleteerror = this.onAutocompleteerror_.bind(this);

  this.racForm_.requestAutocomplete();
  return true;
};


/** @param {Event} e An autocomplete event. */
CustomFlow.prototype.onAutocomplete_ = function(e) {
  this.gotResult_(getResultFromForm(this.racForm_));
};


/** @param {Event} e An autocompleteerror event. */
CustomFlow.prototype.onAutocompleteerror_ = function(e) {
  this.gotResult_(null);
};


/**
 * @param {Object} result The result of the run of rAc() or null if it failed.
 */
CustomFlow.prototype.gotResult_ = function(result) {
  if (result)
    this.success_(result);
  else
    this.failure_();
};


/**
 * The public API. Keys are 'quoted' to remain unchanged if closure compiled.
 */
return {
  /**
   * Disable the rAc() Magento flow and reshow checkout sections. Does not hide
   * rAc() UI if already showing.
   * @see MagentoFlow.disable
   */
  'disable': function() {
    MagentoFlow.disable();
  },

  /**
   * Integrates requestAutocomplete into the Magento checkout flow.
   * @return {boolean} Whether enabling the Magento rAc() flow succeeded.
   * @see MagentoFlow.enable
   */
  'enable': function() {
    return MagentoFlow.enable();
  },

  /**
   * @return {boolean} Whether the current browser is supported.
   * @see Support.isBrowserSupported
   */
  'isBrowserSupported': function() {
    return Support.isBrowserSupported();
  },

  /**
   * @return {boolean} Whether the current Magento environment is supported.
   * @see Support.isMagentoSupported
   */
  'isMagentoSupported': function() {
    return Support.isMagentoSupported();
  },

  /**
   * A way to manually trigger requestAutocomplete() for custom flows.
   * @param {function(Object)} success Callback for successful rAc() runs.
   * @param {Function=} opt_failure Callback for rAc() errors.
   * @param {boolean=} opt_billingOnly Whether to only ask for billing info.
   * @return {Object.<string>} The result of the rAc() run in the form of
   *     autocomplete type => value. Returns null on failure.
   * @see CustomFlow
   */
  'custom': function(success, opt_error, opt_billingOnly) {
    return new CustomFlow(succcess, opt_error, opt_billingOnly).run();
  }
};


}());
