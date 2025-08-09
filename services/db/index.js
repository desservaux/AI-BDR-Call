const getSupabaseClient = require('./dbClient');
const CallsRepo = require('./CallsRepo');
const TranscriptionsRepo = require('./TranscriptionsRepo');
const EventsRepo = require('./EventsRepo');
const BookingAnalysisRepo = require('./BookingAnalysisRepo');
const ContactsRepo = require('./ContactsRepo');
const PhoneNumbersRepo = require('./PhoneNumbersRepo');
const SequencesRepo = require('./SequencesRepo');
const SequenceEntriesRepo = require('./SequenceEntriesRepo');

module.exports = {
  getSupabaseClient,
  CallsRepo,
  TranscriptionsRepo,
  EventsRepo,
  BookingAnalysisRepo,
  ContactsRepo,
  PhoneNumbersRepo,
  SequencesRepo,
  SequenceEntriesRepo,
};

