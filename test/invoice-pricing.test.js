'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var pricing = require('../lib/pricing');
var tax = require('../lib/tax');
var invoice = require('../lib/invoice');

test('invoice figures match the GST and totals stored when the order was billed', function () {
  var items = [
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];
  var billed = pricing.computeTotals(items, '');
  var invoiced = invoice.computeInvoiceFigures({
    items: items,
    coupon: '',
    subtotal: billed.subtotal,
    discount: billed.discount,
    tax: billed.tax,
    total: billed.total
  });

  assert.equal(invoiced.subtotal, billed.subtotal);
  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.cgst, billed.cgst);
  assert.equal(invoiced.sgst, billed.sgst);
  assert.equal(invoiced.total, billed.total);
});

test('invoice uses the billed HSN GST slabs when order lines have no gstRate', function () {
  // The order route stores HSN but does not store gstRate on its line items.
  var items = [
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 100, qty: 1 },
    { id: 2, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 100, qty: 1 }
  ];

  var billed = pricing.computeTotals(items, '');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: '' });

  assert.equal(billed.subtotal, 200);
  assert.equal(billed.tax, 23);
  assert.equal(billed.cgst, 11.5);
  assert.equal(billed.sgst, 11.5);
  assert.equal(billed.total, 223);

  assert.equal(invoiced.subtotal, billed.subtotal);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.cgst, billed.cgst);
  assert.equal(invoiced.sgst, billed.sgst);
  assert.equal(invoiced.total, billed.total);
  assert.deepEqual(invoiced.rows.map(function (row) { return row.gstPercent; }), [5, 18]);
  assert.deepEqual(invoiced.rows.map(function (row) { return row.lineTax; }), [5, 18]);
});

test('invoice coupon totals and post-discount GST match the billed order', function () {
  var items = [
    { id: 1, sku: 'GRN-001', name: 'Rice', hsn: '1006', price: 1000, qty: 1 },
    { id: 2, sku: 'BEV-001', name: 'Tea', hsn: '0902', price: 1000, qty: 1 }
  ];

  var billed = pricing.computeTotals(items, 'SAVE10');
  var invoiced = invoice.computeInvoiceFigures({ items: items, coupon: 'SAVE10' });

  assert.equal(billed.discount, 150); // SAVE10 cap from coupons.js
  assert.equal(billed.tax, 212.75); // GST after apportioned discount, using HSN slabs
  assert.equal(billed.total, 2062.75);

  assert.equal(invoiced.discount, billed.discount);
  assert.equal(invoiced.tax, billed.tax);
  assert.equal(invoiced.cgst, billed.cgst);
  assert.equal(invoiced.sgst, billed.sgst);
  assert.equal(invoiced.total, billed.total);
  assert.deepEqual(invoiced.rows.map(function (row) { return row.lineTax; }), [46.25, 166.5]);
});

test('CURRENT BEHAVIOUR: GST split rounds CGST first and assigns the remainder to SGST', function () {
  assert.deepEqual(tax.splitCgstSgst(0.05), { cgst: 0.03, sgst: 0.02 });
});
