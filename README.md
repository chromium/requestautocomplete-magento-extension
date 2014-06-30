requestautocomplete-magento-extension
=====================================

An extension to integrate requestAutocomplete() into Magento's checkout flow!

API docs:
=========


**Author:** dbeam@chromium.org (Dan Beam)

addSingletonGetter(ctor)
------------------------
Adds a static |getInstance()| method that always returns the same instance.


**Parameters**

**ctor**:  *!Function*,  Class constructor to add |getInstance()| to.

getResultFromForm(form)
-----------------------
**Parameters**

**form**:  *HTMLFormElement*,  A form to extract results from.

**Returns**

*Object*,  An object form of the fields in |form|.

Support()
---------
A helper to determine whether a browser or Magento environment is supported.


areRequiredMagentoMethodsPresent_()
-----------------------------------
**Returns**

*boolean*,  Whether all of |this.requiredMagentoMethods_| exist.

isRequestAutocompletePresent_()
-------------------------------
**Returns**

*boolean*,  Whether requestAutocomplete is supported by the browser.

isBrowserSupported()
--------------------
**Returns**

*boolean*,  Whether the current browser is supported.

isMagentoSupported()
--------------------
**Returns**

*boolean*,  Whether the current Magento environment is supported.

isBrowserSupported()
--------------------
**Returns**

*boolean*,  Whether the current browser is supported.

isMagentoSupported()
--------------------
**Returns**

*boolean*,  Whether the current Magento environment is supported.

Overlay()
---------
An overlay that shows while a MagentoFlow is progressing.


open()
------
Creates an overlay element and shows it.

close()
-------
Hides the overlay and removes it from the DOM.

MagentoFlow()
-------------
enable()
--------
Integrates requestAutocomplete into the Magento checkout flow.


**Returns**

*boolean*,  Whether the flow is supported on this page.

disable()
---------
Disable the rAc() Magento flow and reshow checkout sections. Does not hide
rAc() UI if already showing.


onClick_(e)
-----------
**Parameters**

**e**:  *!Event*,  A click event.

abortFlow_()
------------
Shows the normal Magento flow (e.g. the non-rAc() flow).


getCurrentStep_()
-----------------
**Returns**

*?string*,  The current checkout step or null if none.

startFlow_()
------------
Starts/resumes the rAc() checkout flow.


isSectionValid_(section)
------------------------
**Parameters**

**section**:  *!Object*,  A possibly valid Magento section object.

**Returns**

*boolean*,  Whether |section| is valid;

fillPaymentForm_()
------------------
**Returns**

*boolean*,  Whether filling succeeded.

getNameOfSection_(section)
--------------------------
**Parameters**

**section**:  *Object*,  A Magento section (e.g. shippingMethod).

**Returns**

*string*,  Name of the Magento section.

getFieldsFromSection_(section)
------------------------------
**Parameters**

**section**:  *Object*,  A part of the Magento checkout flow (e.g. shipping).

**Returns**

*NodeList*,  A list of fields from |section|.

addFieldsFromSection_(section)
------------------------------
Adds form fields from |section| into |form| so they can be filled.


**Parameters**

**section**:  *Object*,  The section of the checkout flow (e.g. shipping).

onAutocomplete_()
-----------------
Handles autocomplete events (e.g. successfully rAc() runs).


onAutocompleteerror_(e)
-----------------------
Handles autocompleteerror events (e.g. a failed rAc() run).


**Parameters**

**e**:  *Event*,  An autocompleteerror event.

isSupported_()
--------------
**Returns**

*boolean*,  Whether the flow is supported.

enable()
--------
**Returns**

*boolean*,  Whether enabling the flow succeeded.

CustomFlow(success, opt_failure, opt_billingOnly)
-------------------------------------------------
A way to manually trigger requestAutocomplete() for custom flows.


**Parameters**

**success**:  *function(Object)*,  Callback for successful rAc() runs.

**opt_failure**:  *Function=*,  Callback for rAc() errors.

**opt_billingOnly**:  *boolean=*,  Whether to only ask for billing info.

run()
-----
Builds a <form> and invokes requestAutocomplete() on it. Results are passed
to the callbacks in |this.options_|.


**Returns**

*boolean*,  Whether the flow was run.

onAutocomplete_(e)
------------------
**Parameters**

**e**:  *Event*,  An autocomplete event.

onAutocompleteerror_(e)
-----------------------
**Parameters**

**e**:  *Event*,  An autocompleteerror event.

gotResult_(result)
------------------
**Parameters**

**result**:  *Object*,  The result of the run of rAc() or null if it failed.

disable()
---------
Disable the rAc() Magento flow and reshow checkout sections. Does not hide
rAc() UI if already showing.


enable()
--------
Integrates requestAutocomplete into the Magento checkout flow.


**Returns**

*boolean*,  Whether enabling the Magento rAc() flow succeeded.

isBrowserSupported()
--------------------
**Returns**

*boolean*,  Whether the current browser is supported.

isMagentoSupported()
--------------------
**Returns**

*boolean*,  Whether the current Magento environment is supported.

custom(success, opt_failure, opt_billingOnly)
---------------------------------------------
A way to manually trigger requestAutocomplete() for custom flows.
Called with a result map of autocomplete type => value.


**Parameters**

**success**:  *function(Object)*,  Callback for successful rAc() runs.

**opt_failure**:  *Function=*,  Callback for rAc() errors.

**opt_billingOnly**:  *boolean=*,  Whether to only ask for billing info.
